import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuditService } from '../audit/audit.service';
import { CreatePlanDto, UpdatePlanDto } from './dto/plan.dto';
import { PlansService } from './plans.service';

@Controller('plans')
export class PlansController {
  constructor(private readonly plans: PlansService) {}

  @Public()
  @Get()
  list() {
    return this.plans.listActive();
  }
}

@Controller('admin/plans')
@Roles(Role.ADMIN)
export class AdminPlansController {
  constructor(
    private readonly plans: PlansService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  list() {
    return this.plans.listAll();
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.plans.getById(id);
  }

  @Post()
  async create(@Body() dto: CreatePlanDto, @CurrentUser('id') actorId: string) {
    const plan = await this.plans.create(dto);
    await this.audit.log({ actorId, action: 'plan.create', entityType: 'Plan', entityId: plan.id });
    return plan;
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdatePlanDto,
    @CurrentUser('id') actorId: string,
  ) {
    const plan = await this.plans.update(id, dto);
    await this.audit.log({
      actorId,
      action: 'plan.update',
      entityType: 'Plan',
      entityId: id,
      metadata: { fields: Object.keys(dto) },
    });
    return plan;
  }

  @Delete(':id')
  async deactivate(@Param('id') id: string, @CurrentUser('id') actorId: string) {
    const plan = await this.plans.deactivate(id);
    await this.audit.log({ actorId, action: 'plan.deactivate', entityType: 'Plan', entityId: id });
    return plan;
  }
}
