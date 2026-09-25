import { IsOptional, IsString } from 'class-validator';

export class SubscribeDto {
  @IsString()
  planId: string;
}

export class AdminSubscriptionsQuery {
  @IsOptional() @IsString() vendorId?: string;
}
