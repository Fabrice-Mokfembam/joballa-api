import type { Request } from 'express';
import type { LocalAuthUser } from '../types/auth-context.type';
import type { AdminRequestContext } from '../types/admin-context.type';

export interface AuthenticatedRequest extends Request {
  user?: LocalAuthUser;
  adminContext?: AdminRequestContext;
}
