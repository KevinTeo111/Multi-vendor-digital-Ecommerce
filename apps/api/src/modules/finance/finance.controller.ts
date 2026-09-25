import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../common/types/auth-user';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { AuditService } from '../audit/audit.service';
import {
  AdjustLedgerDto,
  AdminWithdrawalsQuery,
  ApproveWithdrawalDto,
  EligibilityQuery,
  MarkPaidDto,
  RejectWithdrawalDto,
  RequestWithdrawalDto,
} from './dto/finance.dto';
import { LedgerService } from './ledger.service';
import { WithdrawalsService } from './withdrawals.service';

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
  approve(
    @Param('id') id: string,
    @Body() dto: ApproveWithdrawalDto,
    @CurrentUser('id') adminId: string,
  ) {
    return this.withdrawals.approve(id, adminId, dto.notes);
  }

  @Post('withdrawals/:id/mark-paid')
  markPaid(@Param('id') id: string, @Body() dto: MarkPaidDto, @CurrentUser('id') adminId: string) {
    return this.withdrawals.markPaid(id, adminId, dto.reference, dto.notes);
  }

  @Post('withdrawals/:id/reject')
  reject(
    @Param('id') id: string,
    @Body() dto: RejectWithdrawalDto,
    @CurrentUser('id') adminId: string,
  ) {
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
  async adjust(
    @Param('vendorId') vendorId: string,
    @Body() dto: AdjustLedgerDto,
    @CurrentUser('id') adminId: string,
  ) {
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
