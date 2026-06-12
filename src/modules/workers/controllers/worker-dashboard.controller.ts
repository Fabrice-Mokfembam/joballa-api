import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { LocalAuthUser } from '../../../common/types/auth-context.type';
import { WorkerDashboardService } from '../services/worker-dashboard.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('WORKER')
@Controller('api/worker')
export class WorkerDashboardController {
  constructor(private readonly dashboard: WorkerDashboardService) {}

  @Get('dashboard')
  getDashboard(@CurrentUser() user: LocalAuthUser) {
    return this.dashboard.getDashboard(user.id);
  }
}
