import { Body, Controller, Get, Put } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuditService } from '../audit/audit.service';
import { SettingsService } from './settings.service';

@Controller('settings')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  /** Non-sensitive settings needed by the storefront. */
  @Public()
  @Get('public')
  getPublic() {
    return this.settings.getPublic();
  }
}

@Controller('admin/settings')
@Roles(Role.ADMIN)
export class AdminSettingsController {
  constructor(
    private readonly settings: SettingsService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  getAll() {
    return this.settings.getAll();
  }

  @Put()
  async update(@Body() body: Record<string, unknown>, @CurrentUser('id') actorId: string) {
    const result = await this.settings.update(body);
    await this.audit.log({
      actorId,
      action: 'settings.update',
      entityType: 'Setting',
      metadata: { keys: Object.keys(body) },
    });
    return result;
  }
}
