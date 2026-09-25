import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuditService } from '../audit/audit.service';
import { ListUsersQuery, SetUserStatusDto } from './dto/users.dto';
import { UsersService } from './users.service';

@Controller('admin/users')
@Roles(Role.ADMIN)
export class AdminUsersController {
  constructor(
    private readonly users: UsersService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  list(@Query() query: ListUsersQuery) {
    return this.users.list(query, query);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.users.findPublicById(id);
  }

  @Patch(':id/status')
  async setStatus(
    @Param('id') id: string,
    @Body() dto: SetUserStatusDto,
    @CurrentUser('id') actorId: string,
  ) {
    const user = await this.users.setStatus(id, dto.status);
    await this.audit.log({
      actorId,
      action: 'user.status',
      entityType: 'User',
      entityId: id,
      metadata: { status: dto.status },
    });
    return user;
  }
}
