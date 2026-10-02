import type { Prisma } from '@prisma/client';

/** A review's contribution to its product's rating: only visible reviews count. */
export interface RatingState {
  rating: number;
  visible: boolean;
}

/** Change to apply to Product.ratingSum / ratingCount when a review goes from `before` to `after`. */
export function ratingDelta(before: RatingState | null, after: RatingState | null) {
  const contribution = (s: RatingState | null) =>
    s && s.visible ? { sum: s.rating, count: 1 } : { sum: 0, count: 0 };
  const b = contribution(before);
  const a = contribution(after);
  return { sum: a.sum - b.sum, count: a.count - b.count };
}

export async function applyRatingDelta(
  tx: Prisma.TransactionClient,
  productId: string,
  delta: { sum: number; count: number },
) {
  if (delta.sum === 0 && delta.count === 0) return;
  await tx.product.update({
    where: { id: productId },
    data: { ratingSum: { increment: delta.sum }, ratingCount: { increment: delta.count } },
  });
}

/**
 * Refunded purchases cannot be reviewed: their reviews are removed and leave the product rating.
 * Called inside the refund transaction.
 */
export async function removeReviewsForOrderItems(
  tx: Prisma.TransactionClient,
  orderItemIds: string[],
) {
  const reviews = await tx.review.findMany({
    where: { orderItemId: { in: orderItemIds } },
    select: { id: true, productId: true, rating: true, hidden: true },
  });
  for (const review of reviews) {
    await applyRatingDelta(
      tx,
      review.productId,
      ratingDelta({ rating: review.rating, visible: !review.hidden }, null),
    );
    await tx.review.delete({ where: { id: review.id } });
  }
}
