import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../common/types/auth-user';
import {
  AdminProductsQuery,
  BlockProductDto,
  ConfirmFileDto,
  ConfirmImageDto,
  CreateProductDto,
  PublicProductsQuery,
  RejectProductDto,
  RemoveImageDto,
  RequestImageUploadDto,
  RequestUploadDto,
  UpdateProductDto,
  VendorProductsQuery,
} from './dto/product.dto';
import { ProductFilesService } from './product-files.service';
import { ProductsService } from './products.service';

// ---------------------------------------------------------------------------
// Public storefront
// ---------------------------------------------------------------------------

@Controller('products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Public()
  @Get()
  list(@Query() query: PublicProductsQuery) {
    return this.products.listPublic(query);
  }

  @Public()
  @Get(':slug')
  get(@Param('slug') slug: string) {
    return this.products.getPublicBySlug(slug);
  }
}

// ---------------------------------------------------------------------------
// Vendor dashboard
// ---------------------------------------------------------------------------

@Controller('vendor/products')
@Roles(Role.VENDOR)
export class VendorProductsController {
  constructor(
    private readonly products: ProductsService,
    private readonly files: ProductFilesService,
  ) {}

  @Get()
  list(@CurrentUser('vendorId') vendorId: string, @Query() query: VendorProductsQuery) {
    return this.products.listForVendor(vendorId, query);
  }

  @Post()
  create(@CurrentUser('vendorId') vendorId: string, @Body() dto: CreateProductDto) {
    return this.products.create(vendorId, dto);
  }

  @Get(':id')
  get(@CurrentUser('vendorId') vendorId: string, @Param('id') id: string) {
    return this.products.getForVendor(vendorId, id);
  }

  @Patch(':id')
  update(
    @CurrentUser('vendorId') vendorId: string,
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.products.update(vendorId, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.products.remove(user.vendorId!, id, user.id);
  }

  @Post(':id/submit')
  submit(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.products.submit(user.vendorId!, id, user.id);
  }

  @Post(':id/unpublish')
  unpublish(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.products.unpublish(user.vendorId!, id, user.id);
  }

  // ---- files ----

  @Post(':id/files/upload-url')
  requestFileUpload(
    @CurrentUser('vendorId') vendorId: string,
    @Param('id') id: string,
    @Body() dto: RequestUploadDto,
  ) {
    return this.files.requestFileUpload(vendorId, id, dto);
  }

  @Post(':id/files/confirm')
  confirmFile(
    @CurrentUser('vendorId') vendorId: string,
    @Param('id') id: string,
    @Body() dto: ConfirmFileDto,
  ) {
    return this.files.confirmFile(vendorId, id, dto);
  }

  @Delete(':id/files/:fileId')
  removeFile(
    @CurrentUser('vendorId') vendorId: string,
    @Param('id') id: string,
    @Param('fileId') fileId: string,
  ) {
    return this.files.removeFile(vendorId, id, fileId);
  }

  // ---- images ----

  @Post(':id/images/upload-url')
  requestImageUpload(
    @CurrentUser('vendorId') vendorId: string,
    @Param('id') id: string,
    @Body() dto: RequestImageUploadDto,
  ) {
    return this.files.requestImageUpload(vendorId, id, dto);
  }

  @Post(':id/images/confirm')
  confirmImage(
    @CurrentUser('vendorId') vendorId: string,
    @Param('id') id: string,
    @Body() dto: ConfirmImageDto,
  ) {
    return this.files.confirmImage(vendorId, id, dto);
  }

  @Delete(':id/images')
  removeImage(
    @CurrentUser('vendorId') vendorId: string,
    @Param('id') id: string,
    @Body() dto: RemoveImageDto,
  ) {
    return this.files.removeImage(vendorId, id, dto.storageKey);
  }
}

// ---------------------------------------------------------------------------
// Admin review
// ---------------------------------------------------------------------------

@Controller('admin/products')
@Roles(Role.ADMIN)
export class AdminProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  list(@Query() query: AdminProductsQuery) {
    return this.products.listForAdmin(query);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.products.getForAdmin(id);
  }

  @Get(':id/files/:fileId/download-url')
  fileDownloadUrl(@Param('id') id: string, @Param('fileId') fileId: string) {
    return this.products.adminFileDownloadUrl(id, fileId);
  }

  @Post(':id/approve')
  approve(@Param('id') id: string, @CurrentUser('id') adminId: string) {
    return this.products.approve(id, adminId);
  }

  @Post(':id/reject')
  reject(
    @Param('id') id: string,
    @Body() dto: RejectProductDto,
    @CurrentUser('id') adminId: string,
  ) {
    return this.products.reject(id, adminId, dto.reason);
  }

  @Post(':id/block')
  block(@Param('id') id: string, @Body() dto: BlockProductDto, @CurrentUser('id') adminId: string) {
    return this.products.block(id, adminId, dto.reason);
  }

  @Post(':id/unblock')
  unblock(@Param('id') id: string, @CurrentUser('id') adminId: string) {
    return this.products.unblock(id, adminId);
  }
}
