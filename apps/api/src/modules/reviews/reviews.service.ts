import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { OrderStatus, Prisma } from '@prisma/client';
import { findPage, PaginationDto } from '../../common/dto/pagination.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { applyRatingDelta, ratingDelta } from './rating';

const reviewerSelect = { select: { name: true } } as const;

/** Public view: first name only. */
function publicReview<T extends { buyer: { name: string } }>(review: T) {
  return { ...review, buyer: { name: review.buyer.name.split(' ')[0] } };
}

@Injectable()
export class ReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Visible reviews of an approved product, newest first. */
  async listForProduct(slug: string, dto: PaginationDto) {
    const product = await this.prisma.product.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!product) throw new NotFoundException('Product not found');
    const where: Prisma.ReviewWhereInput = { productId: product.id, hidden: false };
    const page = await findPage(
      dto,
      () =>
        this.prisma.review.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: dto.skip,
          take: dto.pageSize,
          select: {
            id: true,
            rating: true,
            comment: true,
            sellerReply: true,
            sellerRepliedAt: true,
            createdAt: true,
            buyer: reviewerSelect,
          },
        }),
      () => this.prisma.review.count({ where }),
    );
    return { ...page, items: page.items.map(publicReview) };
  }

  /**
   * Creates or edits the buyer's review of one purchased item. Only the buyer of a paid (not
   * refunded) purchase may review it; the product rating changes in the same transaction.
   */
  async upsert(buyerId: string, orderItemId: string, rating: number, comment?: string) {
    const item = await this.prisma.orderItem.findUnique({
      where: { id: orderItemId },
      select: { productId: true, order: { select: { buyerId: true, status: true } } },
    });
    if (!item || item.order.buyerId !== buyerId) throw new NotFoundException('Purchase not found');
    if (item.order.status !== OrderStatus.PAID)
      throw new ForbiddenException('Only paid purchases can be reviewed');

    const text = comment?.trim() || null;
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.review.findUnique({ where: { orderItemId } });
      const review = before
        ? await tx.review.update({ where: { id: before.id }, data: { rating, comment: text } })
        : await tx.review.create({
            data: { orderItemId, productId: item.productId, buyerId, rating, comment: text },
          });
      await applyRatingDelta(
        tx,
        item.productId,
        ratingDelta(before && { rating: before.rating, visible: !before.hidden }, {
          rating,
          visible: !review.hidden,
        }),
      );
      return review;
    });
  }

  listForVendor(vendorId: string, dto: PaginationDto) {
    const where: Prisma.ReviewWhereInput = { product: { vendorId } };
    return findPage(
      dto,
      () =>
        this.prisma.review.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: dto.skip,
          take: dto.pageSize,
          include: {
            buyer: reviewerSelect,
            product: { select: { id: true, title: true, slug: true } },
          },
        }),
      () => this.prisma.review.count({ where }),
    );
  }

  /** The seller answers a review of one of their products (editable). */
  async reply(vendorId: string, reviewId: string, reply: string) {
    const review = await this.prisma.review.findFirst({
      where: { id: reviewId, product: { vendorId } },
      select: { id: true },
    });
    if (!review) throw new NotFoundException('Review not found');
    return this.prisma.review.update({
      where: { id: reviewId },
      data: { sellerReply: reply.trim(), sellerRepliedAt: new Date() },
    });
  }

  listForAdmin(dto: PaginationDto, hidden?: boolean) {
    const where: Prisma.ReviewWhereInput = { hidden };
    return findPage(
      dto,
      () =>
        this.prisma.review.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: dto.skip,
          take: dto.pageSize,
          include: {
            buyer: { select: { name: true, email: true } },
            product: {
              select: {
                id: true,
                title: true,
                slug: true,
                vendor: { select: { storeName: true } },
              },
            },
          },
        }),
      () => this.prisma.review.count({ where }),
    );
  }

  /** Moderation: a hidden review disappears from the product page and from its rating. */
  async setHidden(adminId: string, reviewId: string, hidden: boolean) {
    const updated = await this.prisma.$transaction(async (tx) => {
      const before = await tx.review.findUnique({ where: { id: reviewId } });
      if (!before) throw new NotFoundException('Review not found');
      if (before.hidden === hidden) return before;
      const review = await tx.review.update({ where: { id: reviewId }, data: { hidden } });
      await applyRatingDelta(
        tx,
        review.productId,
        ratingDelta(
          { rating: before.rating, visible: !before.hidden },
          { rating: review.rating, visible: !hidden },
        ),
      );
      return review;
    });
    await this.audit.log({
      actorId: adminId,
      action: hidden ? 'review.hide' : 'review.unhide',
      entityType: 'Review',
      entityId: reviewId,
    });
    return updated;
  }
}
