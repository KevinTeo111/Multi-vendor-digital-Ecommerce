import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { LedgerEntryStatus, LedgerEntryType, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PaginationDto, paginate } from '../../common/dto/pagination.dto';

export interface VendorBalance {
  /** Sale credits still inside the hold period. */
  pendingCents: number;
  /** Spendable balance, net of withdrawal holds. */
  availableCents: number;
}

const RELEASE_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Append-only vendor ledger. Balances are always derived from entries, never stored,
 * so every cent can be traced back to an order item or a withdrawal.
 */
@Injectable()
export class LedgerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(LedgerService.name);
  private releaseTimer: NodeJS.Timeout | null = null;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    this.releaseTimer = setInterval(() => void this.releaseMatured(), RELEASE_INTERVAL_MS);
    this.releaseTimer.unref();
  }

  onModuleDestroy() {
    if (this.releaseTimer) clearInterval(this.releaseTimer);
  }

  /** Moves PENDING credits whose hold period has elapsed to AVAILABLE. Safe to call often. */
  async releaseMatured(vendorId?: string, tx: Prisma.TransactionClient = this.prisma) {
    const result = await tx.ledgerEntry.updateMany({
      where: { vendorId, status: LedgerEntryStatus.PENDING, availableAt: { lte: new Date() } },
      data: { status: LedgerEntryStatus.AVAILABLE },
    });
    if (result.count > 0) this.logger.debug(`Released ${result.count} matured ledger entries`);
    return result.count;
  }

  async getBalance(vendorId: string, tx: Prisma.TransactionClient = this.prisma): Promise<VendorBalance> {
    await this.releaseMatured(vendorId, tx);
    const grouped = await tx.ledgerEntry.groupBy({
      by: ['status'],
      where: { vendorId },
      _sum: { amountCents: true },
    });
    const sum = (status: LedgerEntryStatus) =>
      grouped.find((g) => g.status === status)?._sum.amountCents ?? 0;
    return { pendingCents: sum(LedgerEntryStatus.PENDING), availableCents: sum(LedgerEntryStatus.AVAILABLE) };
  }

  async listEntries(vendorId: string, dto: PaginationDto) {
    await this.releaseMatured(vendorId);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.ledgerEntry.findMany({
        where: { vendorId },
        orderBy: { createdAt: 'desc' },
        skip: dto.skip,
        take: dto.pageSize,
        include: {
          orderItem: { select: { id: true, productTitle: true, orderId: true, order: { select: { orderNumber: true } } } },
          withdrawal: { select: { id: true, status: true } },
        },
      }),
      this.prisma.ledgerEntry.count({ where: { vendorId } }),
    ]);
    return paginate(items, total, dto);
  }

  /** Manual correction by an admin. Positive credits, negative debits; always immediately available. */
  async adjust(vendorId: string, amountCents: number, description: string) {
    return this.prisma.ledgerEntry.create({
      data: {
        vendorId,
        type: LedgerEntryType.ADJUSTMENT,
        status: LedgerEntryStatus.AVAILABLE,
        amountCents,
        description,
      },
    });
  }

  /** Platform-wide totals for the admin finance dashboard. */
  async platformSummary() {
    const [sales, commissions, pending, available, payouts] = await Promise.all([
      this.prisma.orderItem.aggregate({ where: { order: { status: 'PAID' } }, _sum: { priceCents: true }, _count: true }),
      this.prisma.orderItem.aggregate({ where: { order: { status: 'PAID' } }, _sum: { commissionCents: true } }),
      this.prisma.ledgerEntry.aggregate({ where: { status: LedgerEntryStatus.PENDING }, _sum: { amountCents: true } }),
      this.prisma.ledgerEntry.aggregate({ where: { status: LedgerEntryStatus.AVAILABLE }, _sum: { amountCents: true } }),
      this.prisma.withdrawal.groupBy({ by: ['status'], _sum: { amountCents: true }, _count: true }),
    ]);
    return {
      grossSalesCents: sales._sum.priceCents ?? 0,
      paidItems: sales._count,
      commissionCents: commissions._sum.commissionCents ?? 0,
      vendorPendingCents: pending._sum.amountCents ?? 0,
      vendorAvailableCents: available._sum.amountCents ?? 0,
      withdrawals: payouts.map((p) => ({ status: p.status, count: p._count, amountCents: p._sum.amountCents ?? 0 })),
    };
  }
}
