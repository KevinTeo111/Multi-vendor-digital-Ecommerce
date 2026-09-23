import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { Role, UserStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { AuditService } from '../audit/audit.service';
import { UsersService } from './users.service';

class ListUsersQuery extends PaginationDto {
  @IsOptional() @IsEnum(Role) role?: Role;
  @IsOptional() @IsEnum(UserStatus) status?: UserStatus;
  @IsOptional() @IsString() search?: string;
}

class SetUserStatusDto {
  @IsEnum(UserStatus) status: UserStatus;
}

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
