import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import { env } from '../../../config/env';
import {
  CheckoutResult,
  CreateCheckoutInput,
  CreateRecipientInput,
  CreateSubscriptionInput,
  NormalizedWebhookEvent,
  PaymentGateway,
  SubscriptionResult,
  TransferInput,
  TransferResult,
  WebhookHeaders,
} from './payment-gateway.interface';

/**
 * Pagar.me API v5 adapter (https://api.pagar.me/core/v5).
 *
 * Confirmed against the public docs: base URL, Basic auth with the secret key as
 * username, POST /orders, POST /recipients (register_information + default_bank_account).
 *
 * MUST BE VERIFIED IN THE SANDBOX before go-live (the docs were not reachable while
 * writing this): the hosted "checkout" payment method shape, POST /subscriptions,
 * POST /recipients/{id}/withdrawals, and the exact webhook event names and payloads.
 * Each of those spots is marked with `SANDBOX-CHECK`.
 */
@Injectable()
export class PagarmePaymentGateway implements PaymentGateway {
  readonly name = 'pagarme' as const;
  private readonly logger = new Logger(PagarmePaymentGateway.name);
  private readonly baseUrl = 'https://api.pagar.me/core/v5';

  constructor() {
    if (!env.PAGARME_SECRET_KEY) {
      throw new Error('PAGARME_SECRET_KEY is required when PAYMENT_GATEWAY=pagarme');
    }
  }

  // ---- Checkout ----------------------------------------------------------

  async createCheckout(input: CreateCheckoutInput): Promise<CheckoutResult> {
    // SANDBOX-CHECK: hosted checkout payment method and `checkouts[].payment_url` in the response.
    const order = await this.request<PagarmeOrder>('POST', '/orders', {
      code: input.orderNumber,
      customer: this.customerPayload(input.customer),
      items: input.items.map((i) => ({
        description: i.description.slice(0, 256),
        amount: i.amountCents,
        quantity: i.quantity,
        code: i.description.slice(0, 52),
      })),
      payments: [
        {
          payment_method: 'checkout',
          checkout: {
            expires_in: 60 * 24,
            billing_address_editable: false,
            customer_editable: true,
            accepted_payment_methods: ['credit_card', 'pix', 'boleto'],
            success_url: input.successUrl,
            skip_checkout_success_page: true,
            credit_card: { installments: [{ number: 1, total: input.amountCents }] },
            pix: { expires_in: 60 * 60 },
            boleto: { due_at: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString() },
          },
        },
      ],
      metadata: { orderId: input.orderId },
    });

    const checkoutUrl = order.checkouts?.[0]?.payment_url;
    return { gatewayOrderId: order.id, checkoutUrl, status: this.mapOrderStatus(order.status) };
  }

  // ---- Subscriptions -----------------------------------------------------

  async createSubscription(input: CreateSubscriptionInput): Promise<SubscriptionResult> {
    if (!input.cardToken) {
      throw new BadRequestException('A card token is required to subscribe to a paid plan');
    }

    // SANDBOX-CHECK: subscription body (items + pricing_scheme vs plan_id) and `current_cycle` in the response.
    const body: Record<string, unknown> = {
      code: `${input.vendorId}:${input.planId}`,
      customer: this.customerPayload(input.customer),
      payment_method: 'credit_card',
      card_token: input.cardToken,
      currency: input.currency,
      interval: input.interval === 'YEAR' ? 'year' : 'month',
      interval_count: 1,
      billing_type: 'prepaid',
      installments: 1,
      statement_descriptor: 'MARKETPLACE',
      metadata: { vendorId: input.vendorId, planId: input.planId },
    };
    if (input.gatewayPlanId) {
      body.plan_id = input.gatewayPlanId;
    } else {
      body.items = [
        { description: input.planName.slice(0, 256), quantity: 1, pricing_scheme: { scheme_type: 'unit', price: input.priceCents } },
      ];
    }

    const sub = await this.request<PagarmeSubscription>('POST', '/subscriptions', body);
    return {
      gatewaySubscriptionId: sub.id,
      status: sub.status === 'active' ? 'active' : sub.status === 'failed' || sub.status === 'canceled' ? 'failed' : 'pending',
      currentPeriodStart: sub.current_cycle?.start_at ? new Date(sub.current_cycle.start_at) : undefined,
      currentPeriodEnd: sub.current_cycle?.end_at ? new Date(sub.current_cycle.end_at) : sub.next_billing_at ? new Date(sub.next_billing_at) : undefined,
    };
  }

  async cancelSubscription(gatewaySubscriptionId: string): Promise<void> {
    await this.request('DELETE', `/subscriptions/${gatewaySubscriptionId}`, { cancel_pending_invoices: true });
  }

  // ---- Recipients & payouts ----------------------------------------------

  async createRecipient(input: CreateRecipientInput): Promise<{ recipientId: string }> {
    const d = input.payoutDetails as {
      type?: 'PIX' | 'BANK';
      holderName?: string;
      holderDocument?: string;
      bankCode?: string;
      branch?: string;
      accountNumber?: string;
      accountType?: 'CHECKING' | 'SAVINGS';
      pixKey?: string;
    };
    const document = (d.holderDocument ?? input.document ?? '').replace(/\D/g, '');
    if (!document) throw new BadRequestException('Vendor payout details are missing the holder document');
    const isCompany = document.length > 11;

    if (d.type !== 'BANK' || !d.bankCode || !d.branch || !d.accountNumber) {
      // Pagar.me recipients are created with a bank account; PIX-only payouts need a bank account on file too.
      throw new BadRequestException('Pagar.me payouts require full bank account details (bank, branch, account number)');
    }
    const [branchNumber, branchDigit] = splitDigit(d.branch);
    const [accountNumber, accountDigit] = splitDigit(d.accountNumber);

    const recipient = await this.request<{ id: string; status: string }>('POST', '/recipients', {
      code: input.vendorId,
      register_information: {
        name: input.name,
        email: input.email,
        document,
        type: isCompany ? 'corporation' : 'individual',
      },
      default_bank_account: {
        holder_name: d.holderName ?? input.name,
        holder_type: isCompany ? 'company' : 'individual',
        holder_document: document,
        bank: d.bankCode,
        branch_number: branchNumber,
        branch_check_digit: branchDigit,
        account_number: accountNumber,
        account_check_digit: accountDigit ?? '0',
        type: d.accountType === 'SAVINGS' ? 'savings' : 'checking',
      },
      // The platform decides when to pay out (admin-approved withdrawals), so automatic transfers stay off.
      transfer_settings: { transfer_enabled: false, transfer_interval: 'daily', transfer_day: 0 },
      metadata: { vendorId: input.vendorId },
    });
    return { recipientId: recipient.id };
  }

  async createTransfer(input: TransferInput): Promise<TransferResult> {
    // SANDBOX-CHECK: withdrawal endpoint and status values. The recipient must hold enough balance
    // in Pagar.me, which requires orders to be split to the recipient or a platform-side transfer.
    const transfer = await this.request<{ id: string; status: string }>('POST', `/recipients/${input.recipientId}/withdrawals`, {
      amount: input.amountCents,
      metadata: { withdrawalId: input.withdrawalId },
    });
    return { gatewayTransferId: transfer.id, status: this.mapTransferStatus(transfer.status) };
  }

  // ---- Webhooks ----------------------------------------------------------

  /**
   * Pagar.me webhooks are authenticated with Basic credentials configured in the dashboard,
   * not an HMAC. Set PAGARME_WEBHOOK_SECRET to "user:password" (the same pair entered there).
   */
  verifyWebhook(_rawBody: Buffer, headers: WebhookHeaders): boolean {
    const expected = env.PAGARME_WEBHOOK_SECRET;
    if (!expected) {
      this.logger.warn('PAGARME_WEBHOOK_SECRET is not set; rejecting webhook');
      return false;
    }
    const raw = headers.authorization;
    const header = Array.isArray(raw) ? raw[0] : raw;
    if (!header?.startsWith('Basic ')) return false;
    const provided = Buffer.from(header.slice(6), 'base64');
    const wanted = Buffer.from(expected);
    return provided.length === wanted.length && timingSafeEqual(provided, wanted);
  }

  parseWebhook(payload: unknown): NormalizedWebhookEvent {
    // SANDBOX-CHECK: event names and `data` shapes.
    const p = (payload ?? {}) as { id?: string; type?: string; data?: Record<string, unknown> };
    const eventId = p.id ?? `${p.type}:${Date.now()}`;
    const data = (p.data ?? {}) as PagarmeWebhookData;

    switch (p.type) {
      case 'order.paid': {
        const charge = data.charges?.[0];
        return { kind: 'order.paid', eventId, gatewayOrderId: data.id ?? '', chargeId: charge?.id, paymentMethod: charge?.payment_method };
      }
      case 'order.payment_failed':
      case 'order.canceled':
        return { kind: 'order.failed', eventId, gatewayOrderId: data.id ?? '', reason: p.type };

      case 'invoice.paid': {
        const subId = data.subscription?.id ?? '';
        const start = data.cycle?.start_at ? new Date(data.cycle.start_at) : undefined;
        const end = data.cycle?.end_at ? new Date(data.cycle.end_at) : undefined;
        return { kind: 'subscription.renewed', eventId, gatewaySubscriptionId: subId, periodStart: start, periodEnd: end };
      }
      case 'invoice.payment_failed':
        return { kind: 'subscription.past_due', eventId, gatewaySubscriptionId: data.subscription?.id ?? '' };
      case 'subscription.canceled':
        return { kind: 'subscription.canceled', eventId, gatewaySubscriptionId: data.id ?? '' };

      case 'transfer.paid':
      case 'transfer.transferred':
        return { kind: 'transfer.paid', eventId, gatewayTransferId: data.id ?? '' };
      case 'transfer.failed':
      case 'transfer.canceled':
        return { kind: 'transfer.failed', eventId, gatewayTransferId: data.id ?? '', reason: p.type };

      default:
        return { kind: 'ignored', eventId, type: p.type ?? 'unknown' };
    }
  }

  // ---- HTTP ---------------------------------------------------------------

  private async request<T>(method: 'GET' | 'POST' | 'DELETE', path: string, body?: unknown): Promise<T> {
    const auth = Buffer.from(`${env.PAGARME_SECRET_KEY}:`).toString('base64');
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let json: unknown = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = text;
    }
    if (!res.ok) {
      const message = (json as { message?: string })?.message ?? `Pagar.me ${method} ${path} failed (${res.status})`;
      this.logger.error(`${message}: ${text.slice(0, 500)}`);
      throw new Error(message);
    }
    return json as T;
  }

  private customerPayload(c: { id: string; name: string; email: string; document?: string }) {
    return {
      code: c.id,
      name: c.name,
      email: c.email,
      ...(c.document ? { document: c.document.replace(/\D/g, ''), type: c.document.replace(/\D/g, '').length > 11 ? 'company' : 'individual' } : {}),
    };
  }

  private mapOrderStatus(status: string): CheckoutResult['status'] {
    if (status === 'paid') return 'paid';
    if (status === 'failed' || status === 'canceled') return 'failed';
    return 'pending';
  }

  private mapTransferStatus(status: string): TransferResult['status'] {
    if (status === 'transferred' || status === 'paid') return 'paid';
    if (status === 'failed' || status === 'canceled') return 'failed';
    return 'pending';
  }
}

/** "1234-5" -> ["1234", "5"]; "1234" -> ["1234", undefined] */
function splitDigit(value: string): [string, string | undefined] {
  const cleaned = value.replace(/\s/g, '');
  const [num, digit] = cleaned.split('-');
  return [num, digit];
}

interface PagarmeOrder {
  id: string;
  status: string;
  checkouts?: Array<{ id: string; payment_url?: string; status?: string }>;
  charges?: Array<{ id: string; status: string; payment_method?: string }>;
}

interface PagarmeSubscription {
  id: string;
  status: string;
  current_cycle?: { start_at?: string; end_at?: string; status?: string };
  next_billing_at?: string;
}

interface PagarmeWebhookData {
  id?: string;
  status?: string;
  charges?: Array<{ id: string; payment_method?: string }>;
  subscription?: { id?: string };
  cycle?: { start_at?: string; end_at?: string };
}
