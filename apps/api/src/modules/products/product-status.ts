import { BadRequestException } from '@nestjs/common';
import { ProductStatus } from '@prisma/client';

/**
 * Product lifecycle in one place.
 *
 *   DRAFT ──submit──▶ PENDING_REVIEW ──approve──▶ APPROVED ◀──republish── UNPUBLISHED
 *                          │ reject                  │ unpublish              ▲
 *                          ▼                          └────────────────────────┘
 *                       REJECTED ──submit──▶ PENDING_REVIEW
 *   any (except PENDING_REVIEW/BLOCKED) ──block──▶ BLOCKED ──unblock──▶ APPROVED | DRAFT
 */
export const PRODUCT_TRANSITIONS: Record<ProductStatus, readonly ProductStatus[]> = {
  DRAFT: ['PENDING_REVIEW', 'BLOCKED'],
  PENDING_REVIEW: ['APPROVED', 'REJECTED'],
  APPROVED: ['UNPUBLISHED', 'BLOCKED'],
  REJECTED: ['PENDING_REVIEW', 'BLOCKED'],
  UNPUBLISHED: ['PENDING_REVIEW', 'APPROVED', 'BLOCKED'],
  BLOCKED: ['APPROVED', 'DRAFT'],
};

/** Statuses that count against the plan's product limit. */
export const LISTED_STATUSES: readonly ProductStatus[] = ['APPROVED', 'PENDING_REVIEW'];

/** Vendors may edit product details in these statuses. */
export const EDITABLE_STATUSES: readonly ProductStatus[] = [
  'DRAFT',
  'REJECTED',
  'UNPUBLISHED',
  'APPROVED',
  'PENDING_REVIEW',
];

/** Statuses from which a vendor can (re)submit. */
export const SUBMITTABLE_STATUSES: readonly ProductStatus[] = ['DRAFT', 'REJECTED', 'UNPUBLISHED'];

export function canTransition(from: ProductStatus, to: ProductStatus): boolean {
  return PRODUCT_TRANSITIONS[from].includes(to);
}

/** Throws a 400 with a readable message when the transition is not allowed. */
export function assertTransition(from: ProductStatus, to: ProductStatus): void {
  if (!canTransition(from, to)) {
    throw new BadRequestException(`A product in status ${from} cannot move to ${to}`);
  }
}
