import { WithdrawalStatus } from '@prisma/client';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  NotEquals,
} from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class RequestWithdrawalDto {
  /** Omit to withdraw the full available balance. */
  @IsOptional()
  @IsInt()
  @Min(1)
  amountCents?: number;
}

export class EligibilityQuery {
  @IsOptional()
  @IsInt()
  @Min(1)
  amountCents?: number;
}

export class AdminWithdrawalsQuery extends PaginationDto {
  @IsOptional() @IsEnum(WithdrawalStatus) status?: WithdrawalStatus;
}

export class ApproveWithdrawalDto {
  @IsOptional() @IsString() @MaxLength(1000) notes?: string;
}

export class MarkPaidDto {
  /** Bank/PIX transaction reference, shown to the vendor. */
  @IsOptional() @IsString() @MaxLength(120) reference?: string;
  @IsOptional() @IsString() @MaxLength(1000) notes?: string;
}

export class RejectWithdrawalDto {
  @IsString() @MinLength(3) @MaxLength(1000) reason: string;
}

export class AdjustLedgerDto {
  @IsInt()
  @NotEquals(0)
  amountCents: number;

  @IsString()
  @MinLength(3)
  @MaxLength(500)
  description: string;
}
