import {
  Controller,
  Get,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { LocalAuthUser } from '../../../common/types/auth-context.type';
import { WorkerNotificationsService } from '../services/worker-notifications.service';
import { WorkerNotificationSettingsDto } from '../dto/workers.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('WORKER')
@Controller('api/worker')
export class WorkerNotificationsController {
  constructor(private readonly notifications: WorkerNotificationsService) {}

  @Get('notifications')
  list(
    @Query('filter') filter: string | undefined,
    @Query('page') page: string | undefined,
    @Query('limit') limit: string | undefined,
    @CurrentUser() user: LocalAuthUser,
  ) {
    return this.notifications.list(
      user.id,
      filter,
      page ? Number(page) : 1,
      limit ? Number(limit) : 20,
    );
  }

  @Patch('notifications/:id/read')
  markRead(@Param('id') id: string, @CurrentUser() user: LocalAuthUser) {
    return this.notifications.markRead(user.id, id);
  }

  @Patch('settings/notifications')
  updateSettings(
    @Body() dto: WorkerNotificationSettingsDto,
    @CurrentUser() user: LocalAuthUser,
  ) {
    return this.notifications.saveSettings(user.id, dto);
  }
}
