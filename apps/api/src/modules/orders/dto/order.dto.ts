import { OrderStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';
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
