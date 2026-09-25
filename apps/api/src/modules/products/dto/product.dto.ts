import { ProductStatus } from '@prisma/client';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class CreateProductDto {
  @IsString()
  @MinLength(3)
  @MaxLength(140)
  title: string;

  @IsString()
  categoryId: string;

  @IsString()
  @MinLength(10)
  @MaxLength(300)
  shortDescription: string;

  @IsString()
  @MinLength(20)
  @MaxLength(20_000)
  description: string;

  @IsInt()
  @Min(0)
  @Max(100_000_000)
  priceCents: number;

  @IsOptional()
  @IsUrl({ require_tld: false })
  demoUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  version?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(15)
  @IsString({ each: true })
  @MaxLength(30, { each: true })
  tags?: string[];
}

export class UpdateProductDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(140)
  title?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(300)
  shortDescription?: string;

  @IsOptional()
  @IsString()
  @MinLength(20)
  @MaxLength(20_000)
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100_000_000)
  priceCents?: number;

  @IsOptional()
  @IsUrl({ require_tld: false })
  demoUrl?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  version?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(15)
  @IsString({ each: true })
  @MaxLength(30, { each: true })
  tags?: string[];
}

export class RequestUploadDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  fileName: string;

  @IsString()
  @MaxLength(120)
  contentType: string;

  @IsInt()
  @Min(1)
  sizeBytes: number;
}

export class ConfirmFileDto {
  @IsString()
  storageKey: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  fileName: string;

  @IsOptional()
  @IsBoolean()
  isMain?: boolean;
}

export class RequestImageUploadDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  fileName: string;

  @IsIn(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
  contentType: string;

  @IsIn(['thumbnail', 'preview'])
  kind: 'thumbnail' | 'preview';
}

export class ConfirmImageDto {
  @IsString()
  storageKey: string;

  @IsIn(['thumbnail', 'preview'])
  kind: 'thumbnail' | 'preview';
}

export class RemoveImageDto {
  @IsString()
  storageKey: string;
}

export class BlockProductDto {
  @IsOptional() @IsString() @MaxLength(1000) reason?: string;
}

export class RejectProductDto {
  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  reason: string;
}

export class VendorProductsQuery extends PaginationDto {
  @IsOptional() @IsEnum(ProductStatus) status?: ProductStatus;
  @IsOptional() @IsString() search?: string;
}

export class AdminProductsQuery extends PaginationDto {
  @IsOptional() @IsEnum(ProductStatus) status?: ProductStatus;
  @IsOptional() @IsString() vendorId?: string;
  @IsOptional() @IsString() search?: string;
}

export class PublicProductsQuery extends PaginationDto {
  @IsOptional() @IsString() @MaxLength(100) search?: string;
  @IsOptional() @IsString() category?: string; // category slug
  @IsOptional() @IsString() vendor?: string; // vendor slug
  @IsOptional() @IsIn(['newest', 'popular', 'price_asc', 'price_desc']) sort?:
    'newest' | 'popular' | 'price_asc' | 'price_desc';
  @IsOptional() @IsInt() @Min(0) minPriceCents?: number;
  @IsOptional() @IsInt() @Min(0) maxPriceCents?: number;
}
