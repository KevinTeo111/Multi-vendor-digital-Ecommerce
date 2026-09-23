import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuditService } from '../audit/audit.service';
import { ListVendorsQuery, SetVendorStatusDto, UpdateVendorProfileDto } from './dto/vendor.dto';
import { VendorsService } from './vendors.service';

@Controller('vendors')
export class VendorsController {
  constructor(private readonly vendors: VendorsService) {}

  @Roles(Role.VENDOR)
  @Get('me')
  me(@CurrentUser('vendorId') vendorId: string) {
    return this.vendors.getMe(vendorId);
  }

  @Roles(Role.VENDOR)
  @Patch('me')
  updateMe(@CurrentUser('vendorId') vendorId: string, @Body() dto: UpdateVendorProfileDto) {
    return this.vendors.updateMe(vendorId, dto);
  }

  @Public()
  @Get(':slug')
  storefront(@Param('slug') slug: string) {
    return this.vendors.getPublicBySlug(slug);
  }
}

@Controller('admin/vendors')
@Roles(Role.ADMIN)
export class AdminVendorsController {
  constructor(
    private readonly vendors: VendorsService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  list(@Query() query: ListVendorsQuery) {
    return this.vendors.listForAdmin(query);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.vendors.getForAdmin(id);
  }

  @Patch(':id/status')
  async setStatus(
    @Param('id') id: string,
    @Body() dto: SetVendorStatusDto,
    @CurrentUser('id') actorId: string,
  ) {
    const vendor = await this.vendors.setStatus(id, dto.status);
    await this.audit.log({
      actorId,
      action: 'vendor.status',
      entityType: 'Vendor',
      entityId: id,
      metadata: { status: dto.status, reason: dto.reason ?? null },
    });
    return vendor;
  }
}
