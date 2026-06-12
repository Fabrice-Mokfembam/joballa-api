import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Role, type EmployerProfile, type User } from '@prisma/client';
import { EmployerProfilesRepository } from '../../employer-profiles/repositories/employer-profiles.repository';
import { UsersService } from '../../users/services/users.service';
import type { LocalAuthUser } from '../../../common/types/auth-context.type';

@Injectable()
export class EmployerContextService {
  constructor(
    private readonly usersService: UsersService,
    private readonly employerProfilesRepository: EmployerProfilesRepository,
  ) {}

  async requireEmployerProfile(authUser: LocalAuthUser): Promise<{
    user: User;
    profile: EmployerProfile;
  }> {
    if (authUser.role !== Role.EMPLOYER) {
      throw new ForbiddenException('This route is for employer accounts only.');
    }

    const user = await this.usersService.findById(authUser.id);
    if (!user) {
      throw new NotFoundException('User not found.');
    }

    const profile = await this.employerProfilesRepository.findByUserId(user.id);
    if (!profile) {
      throw new NotFoundException('Employer profile not found.');
    }

    return { user, profile };
  }
}
