import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  LedgerEntryStatus,
  LedgerEntryType,
  Prisma,
  VendorStatus,
  WithdrawalStatus,
} from '@prisma/client';
import { SETTING_KEYS } from '@marketplace/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { PaginationDto, paginate } from '../../common/dto/pagination.dto';
import { AuditService } from '../audit/audit.service';
import { PAYMENT_GATEWAY, PaymentGateway } from '../payments/gateway/payment-gateway.interface';
import { SettingsService } from '../settings/settings.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { LedgerService } from './ledger.service';
import { evaluateWithdrawal, WEEK_MS, WithdrawalRuleInput } from './withdrawal-rules';

const OPEN_STATUSES: WithdrawalStatus[] = [WithdrawalStatus.REQUESTED, WithdrawalStatus.APPROVED];
const COUNTED_STATUSES: WithdrawalStatus[] = [WithdrawalStatus.REQUESTED, WithdrawalStatus.APPROVED, WithdrawalStatus.PAID];

@Injectable()
export class WithdrawalsService {
  private readonly logger = new Logger(WithdrawalsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly settings: SettingsService,
    private readonly subscriptions: SubscriptionsService,
    private readonly audit: AuditService,
    @Inject(PAYMENT_GATEWAY) private readonly gateway: PaymentGateway,
  ) {}

  /** What the vendor dashboard shows next to the "Request withdrawal" button. */
  async eligibility(vendorId: string, requestedCents?: number) {
    const input = await this.collectRuleInput(vendorId, requestedCents, this.prisma);
    const result = evaluateWithdrawal(input);
    return {
      ...result,
      availableCents: input.availableCents,
      minWithdrawalCents: input.minWithdrawalCents,
      requestsInLastWeek: input.requestsInLastWeek,
      withdrawalsPerWeek: input.withdrawalsPerWeek,
    };
  }

  /**
   * Creates a withdrawal request and places a hold on the ledger.
   * The vendor row is locked so concurrent requests cannot double-spend the balance.
   */
  async request(vendorId: string, actorId: string, requestedCents?: number) {
    const withdrawal = await this.prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM "Vendor" WHERE id = ${vendorId} FOR UPDATE`;

        const input = await this.collectRuleInput(vendorId, requestedCents, tx);
        const verdict = evaluateWithdrawal(input);
        if (!verdict.ok) throw new BadRequestException(verdict.reason);

        const created = await tx.withdrawal.create({
          data: { vendorId, amountCents: verdict.amountCents, status: WithdrawalStatus.REQUESTED },
        });
        await tx.ledgerEntry.create({
          data: {
            vendorId,
            type: LedgerEntryType.WITHDRAWAL_HOLD,
            status: LedgerEntryStatus.AVAILABLE,
            amountCents: -verdict.amountCents,
            withdrawalId: created.id,
            description: 'Withdrawal requested',
          },
        });
        await this.audit.log(
          {
            actorId,
            action: 'withdrawal.request',
            entityType: 'Withdrawal',
            entityId: created.id,
            metadata: { amountCents: verdict.amountCents },
          },
          tx,
        );
        return created;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );
    return withdrawal;
  }

  async listForVendor(vendorId: string, dto: PaginationDto) {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.withdrawal.findMany({
        where: { vendorId },
        orderBy: { requestedAt: 'desc' },
        skip: dto.skip,
        take: dto.pageSize,
      }),
      this.prisma.withdrawal.count({ where: { vendorId } }),
    ]);
    return paginate(items, total, dto);
  }

  // ---- Admin -------------------------------------------------------------

  async listForAdmin(dto: PaginationDto, status?: WithdrawalStatus) {
    const where: Prisma.WithdrawalWhereInput = { status };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.withdrawal.findMany({
        where,
        orderBy: status === WithdrawalStatus.REQUESTED ? { requestedAt: 'asc' } : { updatedAt: 'desc' },
        skip: dto.skip,
        take: dto.pageSize,
        include: {
          vendor: { select: { id: true, storeName: true, slug: true, payoutDetails: true, gatewayRecipientId: true } },
          reviewedBy: { select: { id: true, name: true } },
        },
      }),
      this.prisma.withdrawal.count({ where }),
    ]);
    return paginate(items, total, dto);
  }

  /**
   * Approves a withdrawal.
   * - payout mode "manual": the withdrawal becomes APPROVED; the admin sends the money by PIX/bank
   *   transfer and then calls markPaid(). Nothing is sent to the gateway.
   * - payout mode "gateway": the transfer is attempted immediately; if the gateway reports it as
   *   pending the withdrawal stays APPROVED until the transfer webhook arrives.
   */
  async approve(id: string, adminId: string, notes?: string) {
    const withdrawal = await this.prisma.withdrawal.findUnique({
      where: { id },
      include: { vendor: { include: { user: { select: { name: true, email: true } } } } },
    });
    if (!withdrawal) throw new NotFoundException('Withdrawal not found');
    if (withdrawal.status !== WithdrawalStatus.REQUESTED) {
      throw new BadRequestException('Only requested withdrawals can be approved');
    }
    if (!withdrawal.vendor.payoutDetails) {
      throw new BadRequestException('Vendor has no payout details on file');
    }

    const payoutMode = await this.settings.get(SETTING_KEYS.PAYOUT_MODE);
    if (payoutMode === 'manual') {
      const updated = await this.prisma.withdrawal.update({
        where: { id },
        data: { status: WithdrawalStatus.APPROVED, reviewedAt: new Date(), reviewedById: adminId, adminNotes: notes },
      });
      await this.audit.log({
        actorId: adminId,
        action: 'withdrawal.approve',
        entityType: 'Withdrawal',
        entityId: id,
        metadata: { amountCents: withdrawal.amountCents, payoutMode },
      });
      return updated;
    }

    let recipientId = withdrawal.vendor.gatewayRecipientId;
    if (!recipientId) {
      const created = await this.gateway.createRecipient({
        vendorId: withdrawal.vendorId,
        name: withdrawal.vendor.user.name,
        email: withdrawal.vendor.user.email,
        payoutDetails: withdrawal.vendor.payoutDetails as Record<string, unknown>,
      });
      recipientId = created.recipientId;
      await this.prisma.vendor.update({
        where: { id: withdrawal.vendorId },
        data: { gatewayRecipientId: recipientId },
      });
    }

    // Mark approved before calling the gateway so a crash mid-transfer never re-pays.
    await this.prisma.withdrawal.update({
      where: { id },
      data: { status: WithdrawalStatus.APPROVED, reviewedAt: new Date(), reviewedById: adminId, adminNotes: notes },
    });

    let transfer;
    try {
      transfer = await this.gateway.createTransfer({ withdrawalId: id, recipientId, amountCents: withdrawal.amountCents });
    } catch (err) {
      this.logger.error(`Transfer failed for withdrawal ${id}: ${(err as Error).message}`);
      return this.markFailed(id, (err as Error).message);
    }

    const updated = await this.prisma.withdrawal.update({
      where: { id },
      data: {
        gatewayTransferId: transfer.gatewayTransferId,
        ...(transfer.status === 'paid' ? { status: WithdrawalStatus.PAID, paidAt: new Date() } : {}),
      },
    });
    if (transfer.status === 'failed') return this.markFailed(id, 'Gateway reported the transfer as failed');

    await this.audit.log({
      actorId: adminId,
      action: 'withdrawal.approve',
      entityType: 'Withdrawal',
      entityId: id,
      metadata: { amountCents: withdrawal.amountCents, transferStatus: transfer.status },
    });
    return updated;
  }

  /**
   * Records that the money was sent outside the gateway (PIX / bank transfer done by the admin).
   * Allowed from REQUESTED (approve and pay in one step) or APPROVED.
   */
  async markPaid(id: string, adminId: string, reference?: string, notes?: string) {
    const withdrawal = await this.prisma.withdrawal.findUnique({ where: { id } });
    if (!withdrawal) throw new NotFoundException('Withdrawal not found');
    const allowed: WithdrawalStatus[] = [WithdrawalStatus.REQUESTED, WithdrawalStatus.APPROVED];
    if (!allowed.includes(withdrawal.status)) {
      throw new BadRequestException(`Withdrawals in status ${withdrawal.status} cannot be marked as paid`);
    }

    const updated = await this.prisma.withdrawal.update({
      where: { id },
      data: {
        status: WithdrawalStatus.PAID,
        paidAt: new Date(),
        reviewedAt: withdrawal.reviewedAt ?? new Date(),
        reviewedById: withdrawal.reviewedById ?? adminId,
        gatewayTransferId: reference ? `manual:${reference.trim()}` : 'manual',
        adminNotes: notes ?? withdrawal.adminNotes,
      },
    });
    await this.audit.log({
      actorId: adminId,
      action: 'withdrawal.mark_paid',
      entityType: 'Withdrawal',
      entityId: id,
      metadata: { amountCents: withdrawal.amountCents, reference: reference ?? null },
    });
    return updated;
  }

  async reject(id: string, adminId: string, reason: string) {
    return this.prisma.$transaction(async (tx) => {
      const withdrawal = await tx.withdrawal.findUnique({ where: { id } });
      if (!withdrawal) throw new NotFoundException('Withdrawal not found');
      if (withdrawal.status !== WithdrawalStatus.REQUESTED) {
        throw new BadRequestException('Only requested withdrawals can be rejected');
      }
      const updated = await tx.withdrawal.update({
        where: { id },
        data: { status: WithdrawalStatus.REJECTED, reviewedAt: new Date(), reviewedById: adminId, rejectionReason: reason },
      });
      await this.releaseHold(tx, withdrawal.vendorId, id, withdrawal.amountCents, 'Withdrawal rejected');
      await this.audit.log(
        { actorId: adminId, action: 'withdrawal.reject', entityType: 'Withdrawal', entityId: id, metadata: { reason } },
        tx,
      );
      return updated;
    });
  }

  // ---- Gateway callbacks -------------------------------------------------

  async markTransferPaid(gatewayTransferId: string) {
    await this.prisma.withdrawal.updateMany({
      where: { gatewayTransferId, status: WithdrawalStatus.APPROVED },
      data: { status: WithdrawalStatus.PAID, paidAt: new Date() },
    });
  }

  async markTransferFailed(gatewayTransferId: string, reason?: string) {
    const withdrawal = await this.prisma.withdrawal.findFirst({
      where: { gatewayTransferId, status: WithdrawalStatus.APPROVED },
    });
    if (withdrawal) await this.markFailed(withdrawal.id, reason ?? 'Transfer failed');
  }

  private async markFailed(id: string, reason: string) {
    return this.prisma.$transaction(async (tx) => {
      const withdrawal = await tx.withdrawal.findUniqueOrThrow({ where: { id } });
      if (withdrawal.status === WithdrawalStatus.FAILED) return withdrawal;
      const updated = await tx.withdrawal.update({
        where: { id },
        data: { status: WithdrawalStatus.FAILED, adminNotes: reason },
      });
      await this.releaseHold(tx, withdrawal.vendorId, id, withdrawal.amountCents, 'Withdrawal failed; funds returned');
      return updated;
    });
  }

  private async releaseHold(tx: Prisma.TransactionClient, vendorId: string, withdrawalId: string, amountCents: number, description: string) {
    const alreadyReleased = await tx.ledgerEntry.findFirst({
      where: { withdrawalId, type: LedgerEntryType.WITHDRAWAL_RELEASE },
    });
    if (alreadyReleased) return;
    await tx.ledgerEntry.create({
      data: {
        vendorId,
        type: LedgerEntryType.WITHDRAWAL_RELEASE,
        status: LedgerEntryStatus.AVAILABLE,
        amountCents,
        withdrawalId,
        description,
      },
    });
  }

  private async collectRuleInput(
    vendorId: string,
    requestedCents: number | undefined,
    tx: Prisma.TransactionClient,
  ): Promise<WithdrawalRuleInput> {
    const vendor = await tx.vendor.findUnique({
      where: { id: vendorId },
      select: { status: true, payoutDetails: true },
    });
    if (!vendor) throw new NotFoundException('Vendor not found');

    const [subscription, balance, minWithdrawalCents, requestsInLastWeek, openCount] = await Promise.all([
      this.subscriptions.getEntitling(vendorId, tx),
      this.ledger.getBalance(vendorId, tx),
      this.settings.get(SETTING_KEYS.MIN_WITHDRAWAL_CENTS),
      tx.withdrawal.count({
        where: { vendorId, status: { in: COUNTED_STATUSES }, requestedAt: { gte: new Date(Date.now() - WEEK_MS) } },
      }),
      tx.withdrawal.count({ where: { vendorId, status: { in: OPEN_STATUSES } } }),
    ]);

    return {
      vendorActive: vendor.status === VendorStatus.ACTIVE,
      hasEntitlingSubscription: subscription !== null,
      hasPayoutDetails: vendor.payoutDetails !== null,
      availableCents: balance.availableCents,
      minWithdrawalCents,
      requestsInLastWeek,
      withdrawalsPerWeek: subscription?.plan.withdrawalsPerWeek ?? 1,
      hasOpenWithdrawal: openCount > 0,
      requestedCents,
    };
  }
}
