import { OrderStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class BuyerOrdersQuery extends PaginationDto {
  @IsOptional() @IsEnum(OrderStatus) status?: OrderStatus;
}

export class AdminOrdersQuery extends PaginationDto {
  @IsOptional() @IsEnum(OrderStatus) status?: OrderStatus;
  @IsOptional() @IsString() buyerId?: string;
  @IsOptional() @IsString() vendorId?: string;
  @IsOptional() @IsString() search?: string; // order number or buyer email
}

export class VendorSalesQuery extends PaginationDto {}

export class RefundOrderDto {
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason: string;
}

export class VerifyPurchaseQuery {
  @IsString()
  @MinLength(8)
  @MaxLength(40)
  code: string;
}
