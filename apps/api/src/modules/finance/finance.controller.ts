import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { Role, WithdrawalStatus } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString, MaxLength, Min, MinLength, NotEquals } from 'class-validator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../common/types/auth-user';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { AuditService } from '../audit/audit.service';
import { LedgerService } from './ledger.service';
import { WithdrawalsService } from './withdrawals.service';

class RequestWithdrawalDto {
  @IsOptional() @IsInt() @Min(1)
  amountCents?: number;
}

class EligibilityQuery {
  @IsOptional() @IsInt() @Min(1)
  amountCents?: number;
}

class AdminWithdrawalsQuery extends PaginationDto {
  @IsOptional() @IsEnum(WithdrawalStatus) status?: WithdrawalStatus;
}

class ApproveWithdrawalDto {
  @IsOptional() @IsString() @MaxLength(1000) notes?: string;
}

class RejectWithdrawalDto {
  @IsString() @MinLength(3) @MaxLength(1000) reason: string;
}

class AdjustLedgerDto {
  @IsInt() @NotEquals(0)
  amountCents: number;

  @IsString() @MinLength(3) @MaxLength(500)
  description: string;
}

@Controller('vendor/finance')
@Roles(Role.VENDOR)
export class VendorFinanceController {
  constructor(
    private readonly ledger: LedgerService,
    private readonly withdrawals: WithdrawalsService,
  ) {}

  @Get('balance')
  balance(@CurrentUser('vendorId') vendorId: string) {
    return this.ledger.getBalance(vendorId);
  }

  @Get('ledger')
  entries(@CurrentUser('vendorId') vendorId: string, @Query() dto: PaginationDto) {
    return this.ledger.listEntries(vendorId, dto);
  }

  @Get('withdrawals')
  list(@CurrentUser('vendorId') vendorId: string, @Query() dto: PaginationDto) {
    return this.withdrawals.listForVendor(vendorId, dto);
  }

  @Get('withdrawals/eligibility')
  eligibility(@CurrentUser('vendorId') vendorId: string, @Query() query: EligibilityQuery) {
    return this.withdrawals.eligibility(vendorId, query.amountCents);
  }

  @Post('withdrawals')
  request(@CurrentUser() user: AuthUser, @Body() dto: RequestWithdrawalDto) {
    return this.withdrawals.request(user.vendorId!, user.id, dto.amountCents);
  }
}

@Controller('admin/finance')
@Roles(Role.ADMIN)
export class AdminFinanceController {
  constructor(
    private readonly ledger: LedgerService,
    private readonly withdrawals: WithdrawalsService,
    private readonly audit: AuditService,
  ) {}

  @Get('summary')
  summary() {
    return this.ledger.platformSummary();
  }

  @Get('withdrawals')
  listWithdrawals(@Query() query: AdminWithdrawalsQuery) {
    return this.withdrawals.listForAdmin(query, query.status);
  }

  @Post('withdrawals/:id/approve')
  approve(@Param('id') id: string, @Body() dto: ApproveWithdrawalDto, @CurrentUser('id') adminId: string) {
    return this.withdrawals.approve(id, adminId, dto.notes);
  }

  @Post('withdrawals/:id/reject')
  reject(@Param('id') id: string, @Body() dto: RejectWithdrawalDto, @CurrentUser('id') adminId: string) {
    return this.withdrawals.reject(id, adminId, dto.reason);
  }

  @Get('vendors/:vendorId/balance')
  vendorBalance(@Param('vendorId') vendorId: string) {
    return this.ledger.getBalance(vendorId);
  }

  @Get('vendors/:vendorId/ledger')
  vendorLedger(@Param('vendorId') vendorId: string, @Query() dto: PaginationDto) {
    return this.ledger.listEntries(vendorId, dto);
  }

  @Post('vendors/:vendorId/ledger/adjust')
  async adjust(@Param('vendorId') vendorId: string, @Body() dto: AdjustLedgerDto, @CurrentUser('id') adminId: string) {
    const entry = await this.ledger.adjust(vendorId, dto.amountCents, dto.description);
    await this.audit.log({
      actorId: adminId,
      action: 'ledger.adjust',
      entityType: 'LedgerEntry',
      entityId: entry.id,
      metadata: { vendorId, amountCents: dto.amountCents, description: dto.description },
    });
    return entry;
  }
}
