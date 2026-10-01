import { Injectable, Logger } from '@nestjs/common';
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { env, primaryWebUrl } from '../../../config/env';
import {
  CHECKOUT_TTL_MS,
  CheckoutResult,
  CreateCheckoutInput,
  CreateSubscriptionInput,
  NormalizedWebhookEvent,
  PaymentGateway,
  PlanLike,
  SubscriptionResult,
  WebhookHeaders,
  WebhookQuery,
  WebhookRejectedError,
} from './payment-gateway.interface';

/**
 * Mercado Pago adapter (Brazil: Pix, card, boleto, account money).
 *
 * - Product purchases: Checkout Pro. A Preference is created with the order number as
 *   `external_reference`; the buyer is redirected to `init_point`. Mercado Pago echoes the
 *   reference back on the payment, so the order is matched on its order number.
 * - Seller plans: a pending preapproval without a plan (own auto_recurring) per
 *   subscription. The preapproval id is final at creation, so no id swap is needed.
 * - Payouts: not implemented; manual payout mode is used (Phase 2: marketplace split).
 * - Webhooks: Mercado Pago sends a pointer (`type` + `data.id`), signed in `x-signature`. The
 *   adapter validates the HMAC, then fetches the object to learn its status. The same id is
 *   notified several times as the status changes, so event ids include the status.
 *
 * Uses the REST API through fetch (no SDK) so the HTTP layer can be stubbed in tests.
 */

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface MercadoPagoOptions {
  fetch?: FetchLike;
  now?: () => number;
  apiUrl?: string;
  /** Text shown on card statements (max 22 chars). */
  statementDescriptor?: string;
  /** Max age of a webhook signature before it is rejected as a replay. */
  signatureToleranceMs?: number;
}

interface MpPreference {
  id: string;
  init_point: string;
  sandbox_init_point?: string;
}

interface MpPayment {
  id: number | string;
  status: string;
  status_detail?: string;
  external_reference?: string | null;
  payment_type_id?: string;
  payment_method_id?: string;
}

interface MpPlan {
  id: string;
  status?: string;
  auto_recurring?: { frequency?: number; frequency_type?: string; transaction_amount?: number };
}

interface MpPreapproval {
  id: string;
  status: string;
  init_point?: string;
  date_created?: string;
  next_payment_date?: string;
  external_reference?: string;
}

interface MpAuthorizedPayment {
  id: number | string;
  preapproval_id: string;
  status: string;
  date_created?: string;
  debit_date?: string;
  payment?: { id?: number; status?: string; status_detail?: string };
}

const DEFAULT_API_URL = 'https://api.mercadopago.com';
const SETTLEMENT_CURRENCY = 'BRL'; // Brazilian accounts charge in BRL only
const DEFAULT_SIGNATURE_TOLERANCE_MS = 60 * 60 * 1000;
/** Order numbers look like ORD-20260930-ABC123 (see generateOrderNumber). */
const ORDER_REFERENCE = /^ORD-/;
const FINAL_FAILURE_STATUSES = new Set(['rejected', 'cancelled']);
const HANDLED_TOPICS = new Set([
  'payment',
  'subscription_preapproval',
  'subscription_authorized_payment',
]);

/** Mercado Pago amounts are decimals (12.34), everything else in the system is integer cents. */
export function toDecimal(cents: number): number {
  return Math.round(cents) / 100;
}

/** ISO 8601 with an explicit offset, the form Mercado Pago documents for date fields. */
function isoWithOffset(ms: number): string {
  return new Date(ms).toISOString().replace(/Z$/, '+00:00');
}

/** Normalizes the provider's method ids to the names understood by `toPaymentMethod`. */
export function normalizePaymentMethod(payment: MpPayment): string | undefined {
  if (payment.payment_method_id === 'pix' || payment.payment_type_id === 'bank_transfer')
    return 'pix';
  switch (payment.payment_type_id) {
    case 'ticket':
      return 'boleto';
    case 'credit_card':
    case 'debit_card':
    case 'prepaid_card':
      return 'card';
    default:
      return payment.payment_type_id;
  }
}

/** Builds the string Mercado Pago signs: only the parts that are present, in this order. */
export function signatureManifest(parts: { dataId?: string; requestId?: string; ts: string }) {
  let manifest = '';
  if (parts.dataId) manifest += `id:${parts.dataId};`;
  if (parts.requestId) manifest += `request-id:${parts.requestId};`;
  manifest += `ts:${parts.ts};`;
  return manifest;
}

export function signManifest(manifest: string, secret: string): string {
  return createHmac('sha256', secret).update(manifest).digest('hex');
}

@Injectable()
export class MercadoPagoPaymentGateway implements PaymentGateway {
  readonly name = 'mercadopago' as const;
  readonly supportsPayouts = false;
  private readonly logger = new Logger(MercadoPagoPaymentGateway.name);
  private readonly fetch: FetchLike;
  private readonly now: () => number;
  private readonly apiUrl: string;
  private readonly statementDescriptor: string;
  private readonly signatureToleranceMs: number;
  /** One secret normally; several while rotating (or when more than one application notifies us). */
  private readonly webhookSecrets: string[];

  constructor(
    private readonly accessToken = env.MP_ACCESS_TOKEN,
    webhookSecret = env.MP_WEBHOOK_SECRET,
    options: MercadoPagoOptions = {},
  ) {
    this.webhookSecrets = parseSecrets(webhookSecret);
    if (!accessToken)
      throw new Error('MP_ACCESS_TOKEN is required when PAYMENT_GATEWAY=mercadopago');
    this.fetch = options.fetch ?? ((input, init) => fetch(input, init));
    this.now = options.now ?? (() => Date.now());
    this.apiUrl = (options.apiUrl ?? DEFAULT_API_URL).replace(/\/+$/, '');
    this.statementDescriptor = (options.statementDescriptor ?? 'DIGIMARKET').slice(0, 22);
    this.signatureToleranceMs = options.signatureToleranceMs ?? DEFAULT_SIGNATURE_TOLERANCE_MS;
  }

  // ---- Checkout ----------------------------------------------------------

  async createCheckout(input: CreateCheckoutInput): Promise<CheckoutResult> {
    assertCurrency(input.currency);
    const now = this.now();
    const preference = await this.request<MpPreference>('POST', '/checkout/preferences', {
      items: input.items.map((item, index) => ({
        id: `${input.orderNumber}-${index + 1}`,
        title: item.description.slice(0, 256),
        quantity: item.quantity,
        unit_price: toDecimal(item.amountCents),
        currency_id: input.currency.toUpperCase(),
      })),
      payer: { email: input.customer.email, name: input.customer.name },
      external_reference: input.orderNumber,
      back_urls: {
        success: input.successUrl,
        pending: input.pendingUrl ?? input.successUrl,
        failure: input.cancelUrl,
      },
      auto_return: 'approved',
      // No notification_url: deliveries come only from the Webhooks configuration of the
      // application that owns the access token. Those are signed with the secret shown in its
      // panel and listed in its delivery history; preference-level deliveries are neither.
      expires: true,
      expiration_date_from: isoWithOffset(now),
      expiration_date_to: isoWithOffset(now + CHECKOUT_TTL_MS),
      statement_descriptor: this.statementDescriptor,
      // One payment only: the buyer pays exactly the listed price, never installment interest.
      payment_methods: { installments: 1, default_installments: 1 },
      metadata: { order_id: input.orderId, order_number: input.orderNumber },
    });
    this.logger.debug(`Preference ${preference.id} created for order ${input.orderNumber}`);
    return {
      gatewayOrderId: input.orderNumber,
      checkoutUrl: preference.init_point,
      status: 'pending',
    };
  }

  // ---- Plans & subscriptions ---------------------------------------------

  /** Creates a preapproval plan for the marketplace plan, reusing the existing one when it still matches. */
  /**
   * Mercado Pago only lets a subscription reference a preapproval plan when the card is tokenized
   * on our side (`card_token_id`, status `authorized`). We redirect to Mercado Pago's hosted page
   * instead, which requires a subscription *without* a plan carrying its own `auto_recurring`.
   * So there is nothing to create here: the id just fingerprints the billing terms, and
   * plans.service clears it whenever price or interval change.
   */
  async syncPlan(plan: PlanLike): Promise<{ gatewayPlanId: string }> {
    assertCurrency(plan.currency);
    return { gatewayPlanId: `inline:${plan.interval}:${plan.priceCents}` };
  }

  /** Pending subscription without a plan: Mercado Pago hosts the card form at `init_point`. */
  async createSubscription(input: CreateSubscriptionInput): Promise<SubscriptionResult> {
    assertCurrency(input.plan.currency);
    const preapproval = await this.request<MpPreapproval>('POST', '/preapproval', {
      reason: `Seller plan: ${input.plan.name}`.slice(0, 256),
      external_reference: input.vendorId,
      payer_email: input.customer.email,
      auto_recurring: {
        frequency: input.plan.interval === 'YEAR' ? 12 : 1,
        frequency_type: 'months',
        transaction_amount: toDecimal(input.plan.priceCents),
        currency_id: input.plan.currency.toUpperCase(),
      },
      back_url: input.successUrl,
      status: 'pending',
    });
    if (!preapproval.init_point)
      throw new Error(
        `Mercado Pago returned subscription ${preapproval.id} without a payment link`,
      );
    return {
      gatewaySubscriptionId: preapproval.id,
      status: 'pending',
      checkoutUrl: preapproval.init_point,
    };
  }

  /** Stops future charges. Local entitlement keeps access until the paid period ends. */
  async cancelSubscription(gatewaySubscriptionId: string): Promise<void> {
    await this.request('PUT', `/preapproval/${gatewaySubscriptionId}`, { status: 'cancelled' });
  }

  // ---- Payouts (Phase 2: marketplace split) ------------------------------

  async createRecipient(): Promise<{ recipientId: string }> {
    throw new Error('Automated payouts are not enabled for Mercado Pago; use manual payout mode');
  }

  async createTransfer(): Promise<never> {
    throw new Error('Automated payouts are not enabled for Mercado Pago; use manual payout mode');
  }

  // ---- Webhooks ----------------------------------------------------------

  async parseWebhook(
    rawBody: Buffer,
    headers: WebhookHeaders,
    query: WebhookQuery = {},
  ): Promise<NormalizedWebhookEvent> {
    if (this.webhookSecrets.length === 0)
      throw new WebhookRejectedError('MP_WEBHOOK_SECRET is not configured');

    let body: {
      type?: string;
      topic?: string;
      resource?: string;
      action?: string;
      data?: { id?: string | number };
    } = {};
    try {
      body = JSON.parse(rawBody.toString('utf8') || '{}');
    } catch {
      throw new WebhookRejectedError('Webhook body is not JSON');
    }

    // Topic name: new format uses `type`, the legacy (IPN-style) format uses `topic`.
    const type = String(query.type ?? body.type ?? query.topic ?? body.topic ?? '');
    // Topics we never act on (merchant_order, …) are dropped before verification: no state changes,
    // and answering 200 stops Mercado Pago from retrying them every 15 minutes.
    if (!HANDLED_TOPICS.has(type))
      return {
        kind: 'ignored',
        eventId: `${type || 'unknown'}:${randomUUID()}`,
        type,
        unverified: true,
      };

    // The signed id is the one from the query string (`data.id`). The legacy format sends it as
    // `id` (and as the tail of `resource` in the body) and may or may not include it in the
    // signature, so both manifests are accepted for that format.
    const modernId = query['data.id'] ?? body.data?.id;
    const legacyId = query.id ?? body.resource?.split('/').pop();
    const dataId = String(modernId ?? legacyId ?? '');
    const candidates = modernId !== undefined ? [dataId] : [dataId, ''];
    this.verifySignature(headers, candidates);

    switch (type) {
      case 'payment':
        return this.paymentEvent(dataId);
      case 'subscription_preapproval':
        return this.preapprovalEvent(dataId);
      case 'subscription_authorized_payment':
        return this.authorizedPaymentEvent(dataId);
      default:
        return { kind: 'ignored', eventId: `${type || 'unknown'}:${dataId}:${randomUUID()}`, type };
    }
  }

  /** Validates `x-signature` against every candidate id (one normally; two for the legacy format). */
  private verifySignature(headers: WebhookHeaders, dataIds: string[]) {
    const signature = single(headers['x-signature']);
    if (!signature) throw new WebhookRejectedError('Missing x-signature header');
    const parts = Object.fromEntries(
      signature.split(',').map((part) => {
        const [key, ...rest] = part.trim().split('=');
        return [key, rest.join('=')];
      }),
    );
    const ts = parts.ts;
    const v1 = parts.v1;
    if (!ts || !v1) throw new WebhookRejectedError('Malformed x-signature header');

    const requestId = single(headers['x-request-id']);
    const given = Buffer.from(v1, 'hex');
    const manifests = [...new Set(dataIds)].map((dataId) =>
      signatureManifest({ dataId: dataId || undefined, requestId, ts }),
    );
    let matchedSecret = -1;
    for (const manifest of manifests) {
      matchedSecret = this.webhookSecrets.findIndex((secret) => {
        const expected = Buffer.from(signManifest(manifest, secret), 'hex');
        return expected.length === given.length && timingSafeEqual(expected, given);
      });
      if (matchedSecret >= 0) break;
    }
    if (matchedSecret < 0) {
      // Hash prefixes are safe to log and tell a wrong secret apart from a wrong manifest.
      const expected = this.webhookSecrets
        .map((secret) => signManifest(manifests[0], secret).slice(0, 8))
        .join('/');
      throw new WebhookRejectedError(
        `Invalid Mercado Pago signature (manifest="${manifests[0]}", expected=${expected}…, given=${v1.slice(0, 8)}…)`,
      );
    }
    if (this.webhookSecrets.length > 1)
      this.logger.debug(`Webhook signature matched secret #${matchedSecret + 1}`);

    const tsNumber = Number(ts);
    const tsMs = tsNumber > 1e12 ? tsNumber : tsNumber * 1000; // seconds or milliseconds
    if (!Number.isFinite(tsMs) || Math.abs(this.now() - tsMs) > this.signatureToleranceMs)
      throw new WebhookRejectedError('Webhook signature timestamp outside tolerance');
  }

  private async paymentEvent(id: string): Promise<NormalizedWebhookEvent> {
    const payment = await this.getOrNull<MpPayment>(`/v1/payments/${id}`);
    if (!payment) return { kind: 'ignored', eventId: `payment:${id}:missing`, type: 'payment' };
    const eventId = `payment:${payment.id}:${payment.status}`;
    const orderNumber = payment.external_reference ?? undefined;
    if (!orderNumber) return { kind: 'ignored', eventId, type: 'payment:no_reference' };
    // Subscription charges also arrive as payments; their reference is the vendor id, not an order
    // number. They are handled through subscription_authorized_payment instead.
    if (!ORDER_REFERENCE.test(orderNumber))
      return { kind: 'ignored', eventId, type: 'payment:not_an_order' };

    switch (payment.status) {
      case 'approved':
        return {
          kind: 'order.paid',
          eventId,
          gatewayOrderId: orderNumber,
          chargeId: String(payment.id),
          paymentMethod: normalizePaymentMethod(payment),
        };
      case 'rejected':
      case 'cancelled':
        return {
          kind: 'order.failed',
          eventId,
          gatewayOrderId: orderNumber,
          reason: payment.status_detail ?? payment.status,
        };
      case 'refunded':
      case 'charged_back':
        return {
          kind: 'order.refunded',
          eventId,
          gatewayOrderId: orderNumber,
          reason: payment.status_detail ?? payment.status,
          chargeback: payment.status === 'charged_back',
        };
      default:
        // pending, in_process, authorized, in_mediation (dispute still open): nothing to do yet.
        return { kind: 'ignored', eventId, type: `payment:${payment.status}` };
    }
  }

  private async preapprovalEvent(id: string): Promise<NormalizedWebhookEvent> {
    const sub = await this.getOrNull<MpPreapproval>(`/preapproval/${id}`);
    if (!sub) return { kind: 'ignored', eventId: `preapproval:${id}:missing`, type: 'preapproval' };
    const eventId = `preapproval:${sub.id}:${sub.status}`;
    switch (sub.status) {
      case 'authorized':
        return {
          kind: 'subscription.activated',
          eventId,
          gatewaySubscriptionId: sub.id,
          periodEnd: toDate(sub.next_payment_date),
        };
      case 'paused':
        return { kind: 'subscription.past_due', eventId, gatewaySubscriptionId: sub.id };
      case 'cancelled':
        return { kind: 'subscription.canceled', eventId, gatewaySubscriptionId: sub.id };
      default:
        return { kind: 'ignored', eventId, type: `preapproval:${sub.status}` };
    }
  }

  private async authorizedPaymentEvent(id: string): Promise<NormalizedWebhookEvent> {
    const charge = await this.getOrNull<MpAuthorizedPayment>(`/authorized_payments/${id}`);
    if (!charge)
      return {
        kind: 'ignored',
        eventId: `authorized_payment:${id}:missing`,
        type: 'authorized_payment',
      };
    const paymentStatus = charge.payment?.status ?? charge.status;
    const eventId = `authorized_payment:${charge.id}:${paymentStatus}`;
    if (paymentStatus === 'approved' || charge.status === 'processed') {
      const sub = await this.getOrNull<MpPreapproval>(`/preapproval/${charge.preapproval_id}`);
      return {
        kind: 'subscription.renewed',
        eventId,
        gatewaySubscriptionId: charge.preapproval_id,
        periodStart: toDate(charge.debit_date ?? charge.date_created),
        periodEnd: toDate(sub?.next_payment_date),
      };
    }
    if (paymentStatus === 'rejected' || paymentStatus === 'cancelled')
      return {
        kind: 'subscription.past_due',
        eventId,
        gatewaySubscriptionId: charge.preapproval_id,
      };
    return { kind: 'ignored', eventId, type: `authorized_payment:${paymentStatus}` };
  }

  // ---- Reconciliation (lost webhooks) ------------------------------------

  /** Payments carrying the order number as `external_reference`, newest first. */
  async lookupOrder(gatewayOrderId: string): Promise<NormalizedWebhookEvent | null> {
    const page = await this.request<{ results?: MpPayment[] }>(
      'GET',
      `/v1/payments/search?external_reference=${encodeURIComponent(gatewayOrderId)}&sort=date_created&criteria=desc`,
    );
    const payments = page.results ?? [];
    const approved = payments.find((p) => p.status === 'approved');
    if (approved) {
      return {
        kind: 'order.paid',
        eventId: `payment:${approved.id}:approved`,
        gatewayOrderId,
        chargeId: String(approved.id),
        paymentMethod: normalizePaymentMethod(approved),
      };
    }
    const open = payments.some((p) => !FINAL_FAILURE_STATUSES.has(p.status));
    if (payments.length > 0 && !open) {
      const latest = payments[0];
      return {
        kind: 'order.failed',
        eventId: `payment:${latest.id}:${latest.status}`,
        gatewayOrderId,
        reason: latest.status_detail ?? latest.status,
      };
    }
    return null; // no attempt yet, or still pending / in process
  }

  async lookupSubscription(gatewaySubscriptionId: string): Promise<NormalizedWebhookEvent | null> {
    const event = await this.preapprovalEvent(gatewaySubscriptionId);
    return event.kind === 'ignored' ? null : event;
  }

  // ---- HTTP --------------------------------------------------------------

  /** Full refund. The key is derived from the charge, so a repeated click cannot refund twice. */
  async refundPayment(chargeId: string): Promise<{ refundId: string }> {
    const refund = await this.request<{ id: number | string }>(
      'POST',
      `/v1/payments/${encodeURIComponent(chargeId)}/refunds`,
      {},
      `refund-${chargeId}`,
    );
    return { refundId: String(refund.id) };
  }

  private async request<T>(
    method: 'GET' | 'POST' | 'PUT',
    path: string,
    body?: unknown,
    idempotencyKey?: string,
  ) {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.accessToken}`,
      Accept: 'application/json',
    };
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
      headers['X-Idempotency-Key'] = idempotencyKey ?? randomUUID();
    }
    const res = await this.fetch(`${this.apiUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(
        `Mercado Pago ${method} ${path} failed (${res.status}): ${text.slice(0, 500)}`,
      );
    }
    return (text ? JSON.parse(text) : {}) as T;
  }

  /** GET that treats 404 as "not found" instead of an error (fake ids from the panel's simulator). */
  private async getOrNull<T>(path: string): Promise<T | null> {
    const res = await this.fetch(`${this.apiUrl}${path}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${this.accessToken}`, Accept: 'application/json' },
    });
    if (res.status === 404) return null;
    const text = await res.text();
    if (!res.ok)
      throw new Error(`Mercado Pago GET ${path} failed (${res.status}): ${text.slice(0, 500)}`);
    return JSON.parse(text) as T;
  }
}

/** Comma-separated list, blanks ignored. */
export function parseSecrets(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function assertCurrency(currency: string) {
  if (currency.toUpperCase() !== SETTLEMENT_CURRENCY)
    throw new Error(
      `Mercado Pago accounts in Brazil charge in ${SETTLEMENT_CURRENCY}; the site currency is ${currency}`,
    );
}

function single(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function toDate(value?: string): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}
