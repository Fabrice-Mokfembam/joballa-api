import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import type { LocalAuthUser } from '../../../common/types/auth-context.type';
import { UpdateEmployerProfileDto } from '../dto/update-employer-profile.dto';
import { EmployerProfilesService } from '../services/employer-profiles.service';

@Controller('employer-profiles')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.EMPLOYER)
export class EmployerProfilesController {
  constructor(
    private readonly employerProfilesService: EmployerProfilesService,
  ) {}

  @Get('me')
  getMe(@CurrentUser() user: LocalAuthUser) {
    return this.employerProfilesService.getMe(user.id);
  }

  @Patch('me')
  updateMe(
    @CurrentUser() user: LocalAuthUser,
    @Body() dto: UpdateEmployerProfileDto,
  ) {
    return this.employerProfilesService.updateMe(user.id, dto);
  }
}
