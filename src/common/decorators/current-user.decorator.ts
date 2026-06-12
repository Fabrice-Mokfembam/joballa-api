import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthenticatedRequest } from '../interfaces/authenticated-request.interface';
import type { LocalAuthUser } from '../types/auth-context.type';

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): LocalAuthUser | null => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    return request.user ?? null;
  },
);
