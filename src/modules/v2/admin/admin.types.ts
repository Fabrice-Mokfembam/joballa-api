import type { AdminRole } from '@prisma/client';
import type { AdminPermissionKey } from './admin.constants';

export type AdminSession = {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  permissions: string[];
  departments: Array<{ id: string; name: string }>;
  lastLoginAt: string | null;
};

export type AdminContext = {
  id: string;
  email: string;
  fullName: string;
  role: AdminRole;
  isActive: boolean;
  permissions: AdminPermissionKey[];
  departmentIds: string[];
  isSuperAdmin: boolean;
  isAdminManager: boolean;
};

export type AdminJwtPayload = {
  sub: string;
  role: AdminRole;
  permissions: string[];
  department_ids: string[];
  typ: 'admin';
};
