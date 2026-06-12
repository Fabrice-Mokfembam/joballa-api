import { Injectable } from '@nestjs/common';
import type { LocalAuthUser } from '../../../common/types/auth-context.type';
import {
  toEmployerMeEntity,
  type EmployerMeEntity,
} from '../entities/employer-me.entity';
import { EmployerContextService } from './employer-context.service';

@Injectable()
export class EmployerMeService {
  constructor(private readonly employerContext: EmployerContextService) {}

  async getMe(authUser: LocalAuthUser): Promise<EmployerMeEntity> {
    const { user, profile } =
      await this.employerContext.requireEmployerProfile(authUser);
    return toEmployerMeEntity(user, profile);
  }
}
