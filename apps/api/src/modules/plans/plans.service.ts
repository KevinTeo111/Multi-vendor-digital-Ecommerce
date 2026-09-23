import { Injectable, NotFoundException } from '@nestjs/common';
import { SubscriptionStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { slugify } from '../../common/utils/slug';
import { CreatePlanDto, UpdatePlanDto } from './dto/plan.dto';

@Injectable()
export class PlansService {
  constructor(private readonly prisma: PrismaService) {}

  listActive() {
    return this.prisma.plan.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { priceCents: 'asc' }],
    });
  }

  async listAll() {
    const plans = await this.prisma.plan.findMany({
      orderBy: [{ sortOrder: 'asc' }, { priceCents: 'asc' }],
      include: {
        _count: { select: { subscriptions: { where: { status: SubscriptionStatus.ACTIVE } } } },
      },
    });
    return plans.map(({ _count, ...plan }) => ({ ...plan, activeSubscriptions: _count.subscriptions }));
  }

  async getById(id: string) {
    const plan = await this.prisma.plan.findUnique({ where: { id } });
    if (!plan) throw new NotFoundException('Plan not found');
    return plan;
  }

  create(dto: CreatePlanDto) {
    return this.prisma.plan.create({
      data: {
        name: dto.name.trim(),
        slug: dto.slug ?? slugify(dto.name),
        description: dto.description,
        priceCents: dto.priceCents,
        interval: dto.interval,
        commissionRateBps: dto.commissionRateBps,
        maxProducts: dto.maxProducts ?? null,
        withdrawalsPerWeek: dto.withdrawalsPerWeek ?? 1,
        isActive: dto.isActive ?? true,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  async update(id: string, dto: UpdatePlanDto) {
    await this.getById(id);
    return this.prisma.plan.update({ where: { id }, data: dto });
  }

  /** Plans are never hard-deleted because order items snapshot them; deactivate instead. */
  async deactivate(id: string) {
    await this.getById(id);
    return this.prisma.plan.update({ where: { id }, data: { isActive: false } });
  }
}
