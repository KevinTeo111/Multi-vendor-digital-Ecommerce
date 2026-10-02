import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { LicenseType } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CartService } from './cart.service';

class AddCartItemDto {
  @IsString()
  productId: string;

  @IsOptional()
  @IsEnum(LicenseType)
  licenseType?: LicenseType;
}

@Controller('cart')
export class CartController {
  constructor(private readonly cart: CartService) {}

  @Get()
  get(@CurrentUser('id') userId: string) {
    return this.cart.get(userId);
  }

  @Post('items')
  add(@CurrentUser('id') userId: string, @Body() dto: AddCartItemDto) {
    return this.cart.addItem(userId, dto.productId, dto.licenseType);
  }

  @Delete('items/:productId')
  remove(@CurrentUser('id') userId: string, @Param('productId') productId: string) {
    return this.cart.removeItem(userId, productId);
  }

  @Delete()
  async clear(@CurrentUser('id') userId: string) {
    await this.cart.clear(userId);
    return this.cart.get(userId);
  }
}
