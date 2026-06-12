import type { Role } from '@prisma/client';

export interface JwtAccessPayload {
  sub: string;
  role?: Role;
  email?: string;
}
