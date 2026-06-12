import { SetMetadata } from '@nestjs/common';
import type { AdminPermissionKey } from '../admin.constants';

export const ADMIN_PERMISSION_KEY = 'admin:permission';

export const RequireAdminPermission = (permission: AdminPermissionKey) =>
  SetMetadata(ADMIN_PERMISSION_KEY, permission);
