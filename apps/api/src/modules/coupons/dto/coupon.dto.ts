import { CouponType } from '@prisma/client';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

export class CreateCouponDto {
  /** Letters, digits, dash and underscore; stored upper-case. */
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{3,30}$/, { message: 'code must be 3-30 letters, digits, - or _' })
  code: string;

  @IsEnum(CouponType)
  type: CouponType;

  /** PERCENT: basis points (1000 = 10%). FIXED: cents. */
  @IsInt()
  @Min(1)
  @Max(100_000_000)
  value: number;

  @IsOptional() @IsInt() @Min(1) minOrderCents?: number;
  @IsOptional() @IsInt() @Min(1) maxRedemptions?: number;
  @IsOptional() @IsInt() @Min(1) @Max(1000) perBuyerLimit?: number;
  @IsOptional() @IsDateString() startsAt?: string;
  @IsOptional() @IsDateString() endsAt?: string;

  /** Admin coupons only: limit to one seller. Seller coupons are always limited to the seller. */
  @IsOptional() @IsString() vendorId?: string;
  /** Limit to one product (a seller may only pick their own). */
  @IsOptional() @IsString() productId?: string;
}

export class UpdateCouponDto {
  @IsOptional() @IsBoolean() active?: boolean;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsDateString()
  endsAt?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsInt()
  @Min(1)
  maxRedemptions?: number | null;
}

export class CouponCodeDto {
  @IsOptional()
  @IsString()
  @MaxLength(30)
  couponCode?: string;
}
