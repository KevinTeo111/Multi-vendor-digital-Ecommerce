import { BadRequestException } from '@nestjs/common';
import { ProductStatus } from '@prisma/client';
import {
  assertTransition,
  canTransition,
  EDITABLE_STATUSES,
  LISTED_STATUSES,
  PRODUCT_TRANSITIONS,
  SUBMITTABLE_STATUSES,
} from './product-status';

describe('product status machine', () => {
  it('covers every status', () => {
    expect(Object.keys(PRODUCT_TRANSITIONS).sort()).toEqual(Object.values(ProductStatus).sort());
  });

  it('allows the documented happy path', () => {
    expect(canTransition('DRAFT', 'PENDING_REVIEW')).toBe(true);
    expect(canTransition('PENDING_REVIEW', 'APPROVED')).toBe(true);
    expect(canTransition('APPROVED', 'UNPUBLISHED')).toBe(true);
    expect(canTransition('UNPUBLISHED', 'APPROVED')).toBe(true);
    expect(canTransition('REJECTED', 'PENDING_REVIEW')).toBe(true);
  });

  it('forbids skipping review and touching products under review', () => {
    expect(canTransition('DRAFT', 'APPROVED')).toBe(false);
    expect(canTransition('PENDING_REVIEW', 'BLOCKED')).toBe(false);
    expect(canTransition('APPROVED', 'APPROVED')).toBe(false);
    expect(() => assertTransition('DRAFT', 'APPROVED')).toThrow(BadRequestException);
  });

  it('exposes consistent helper sets', () => {
    expect(LISTED_STATUSES).toEqual(['APPROVED', 'PENDING_REVIEW']);
    expect(SUBMITTABLE_STATUSES.every((s) => canTransition(s, 'PENDING_REVIEW'))).toBe(true);
    expect(EDITABLE_STATUSES).not.toContain('BLOCKED');
  });
});
