import { BillingInterval } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreatePlanDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name: string;

  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9-]+$/, {
    message: 'slug must contain only lowercase letters, digits and hyphens',
  })
  @MaxLength(80)
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsInt()
  @Min(0)
  priceCents: number;

  @IsOptional()
  @IsEnum(BillingInterval)
  interval?: BillingInterval;

  /** Platform commission in basis points (2000 = 20%). */
  @IsInt()
  @Min(0)
  @Max(10_000)
  commissionRateBps: number;

  /** Maximum number of listed products; omit or null for unlimited. */
  @IsOptional()
  @IsInt()
  @Min(1)
  maxProducts?: number | null;

  /** Withdrawal requests allowed per rolling 7 days. Default 1. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(7)
  withdrawalsPerWeek?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class UpdatePlanDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  priceCents?: number;

  @IsOptional()
  @IsEnum(BillingInterval)
  interval?: BillingInterval;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10_000)
  commissionRateBps?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxProducts?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(7)
  withdrawalsPerWeek?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
