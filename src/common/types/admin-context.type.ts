import type { AdminPermissionKey } from '../../modules/v2/admin/admin.constants';

export type AdminRequestContext = {
  id: string;
  permissions: AdminPermissionKey[];
  departmentIds: string[];
};
