import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { EarningsService } from '../services/earnings.service';
import { EarningsFilterDto } from '../dto/earnings.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { LocalAuthUser } from '../../../common/types/auth-context.type';
import { WorkersService } from '../../workers/services/workers.service';

/**
 * EarningsController
 *
 *   GET /api/earnings/summary          — totals, pending, this month
 *   GET /api/earnings/transactions     — paginated transaction history
 *   GET /api/earnings/statement        — flat list for export (PDF/CSV)
 */
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('WORKER')
@Controller('api/earnings')
export class EarningsController {
  constructor(
    private readonly earningsService: EarningsService,
    private readonly workersService: WorkersService,
  ) {}

  @Get('summary')
  async getSummary(@CurrentUser() user: LocalAuthUser) {
    const workerId = await this.workersService.getWorkerProfileId(user.id);
    return this.earningsService.getSummary(workerId);
  }

  @Get('transactions/:transactionId')
  async getTransaction(
    @Param('transactionId') transactionId: string,
    @CurrentUser() user: LocalAuthUser,
  ) {
    const workerId = await this.workersService.getWorkerProfileId(user.id);
    return this.earningsService.getTransactionById(workerId, transactionId);
  }

  @Get('transactions')
  async getTransactions(
    @Query() dto: EarningsFilterDto,
    @CurrentUser() user: LocalAuthUser,
  ) {
    const workerId = await this.workersService.getWorkerProfileId(user.id);
    return this.earningsService.getTransactions(workerId, dto);
  }

  @Get('statement')
  async getStatement(
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @CurrentUser() user: LocalAuthUser,
  ) {
    const workerId = await this.workersService.getWorkerProfileId(user.id);
    return this.earningsService.getStatement(workerId, from, to);
  }
}
