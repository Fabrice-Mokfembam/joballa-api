import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { AdminRequest } from '../guards/admin-jwt.guard';
import { adminUnauthorized } from '../admin-api-format';

export const CurrentAdmin = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<AdminRequest>();
    if (!request.adminContext) adminUnauthorized();
    return request.adminContext;
  },
);
