import {
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Post,
  Put,
  Param,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { CurrentAdmin } from './decorators/current-admin.decorator';
import { RequireAdminPermission } from './decorators/require-permission.decorator';
import { ADMIN_PERM } from './admin.constants';
import { AdminJwtGuard } from './guards/admin-jwt.guard';
import { AdminV2Service } from './admin-v2.service';
import type { AdminContext } from './admin.types';

@Controller('admin')
@UseGuards(AdminJwtGuard)
export class AdminV2Controller {
  constructor(private readonly admin: AdminV2Service) {}

  @Get('dashboard')
  dashboard(@CurrentAdmin() ctx: AdminContext) {
    return this.admin.getDashboard(ctx);
  }

  @Get('dashboard/analytics')
  dashboardAnalytics(
    @CurrentAdmin() ctx: AdminContext,
    @Query() query: Record<string, unknown>,
  ) {
    return this.admin.getDashboardAnalytics(ctx, query);
  }

  @RequireAdminPermission(ADMIN_PERM.VIEW_PLATFORM_ANALYTICS)
  @Get('dashboard/export')
  async dashboardExport(
    @CurrentAdmin() ctx: AdminContext,
    @Query() query: Record<string, unknown>,
    @Res() res: Response,
  ) {
    const csv = await this.admin.exportDashboardReport(ctx, query);
    const stamp = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="joballa-admin-report-${stamp}.csv"`,
    );
    res.send(csv);
  }

  @Get('me')
  me(@CurrentAdmin() ctx: AdminContext) {
    return this.admin.getMe(ctx);
  }

  @Patch('me')
  patchMe(
    @CurrentAdmin() ctx: AdminContext,
    @Body() body: Record<string, unknown>,
    @Req() req: Request,
  ) {
    return this.admin.patchMe(ctx, body, req);
  }

  @RequireAdminPermission(ADMIN_PERM.VIEW_PLATFORM_LOGS)
  @Get('logs')
  logs(
    @CurrentAdmin() ctx: AdminContext,
    @Query() query: Record<string, unknown>,
  ) {
    return this.admin.listLogs(ctx, query);
  }

  @RequireAdminPermission(ADMIN_PERM.VERIFY_KYC)
  @Get('kyc')
  listKyc(
    @CurrentAdmin() ctx: AdminContext,
    @Query() query: Record<string, unknown>,
  ) {
    return this.admin.listKyc(ctx, query);
  }

  @RequireAdminPermission(ADMIN_PERM.VERIFY_KYC)
  @Get('kyc/:id')
  getKyc(@CurrentAdmin() ctx: AdminContext, @Param('id') id: string) {
    return this.admin.getKyc(ctx, id);
  }

  @RequireAdminPermission(ADMIN_PERM.VERIFY_KYC)
  @Patch('kyc/:id/approve')
  approveKyc(
    @CurrentAdmin() ctx: AdminContext,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    return this.admin.approveKyc(ctx, id, req);
  }

  @RequireAdminPermission(ADMIN_PERM.VERIFY_KYC)
  @Patch('kyc/:id/reject')
  rejectKyc(
    @CurrentAdmin() ctx: AdminContext,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
    @Req() req: Request,
  ) {
    return this.admin.rejectKyc(ctx, id, body, req);
  }

  @RequireAdminPermission(ADMIN_PERM.VERIFY_KYC)
  @Patch('kyc/:id/status')
  updateKycStatus(
    @CurrentAdmin() ctx: AdminContext,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
    @Req() req: Request,
  ) {
    return this.admin.updateKycStatus(ctx, id, body, req);
  }

  @RequireAdminPermission(ADMIN_PERM.VERIFY_DOCUMENTS)
  @Get('documents')
  listDocuments(
    @CurrentAdmin() ctx: AdminContext,
    @Query() query: Record<string, unknown>,
  ) {
    return this.admin.listDocuments(ctx, query);
  }

  @RequireAdminPermission(ADMIN_PERM.VERIFY_DOCUMENTS)
  @Get('documents/:id')
  getDocument(@CurrentAdmin() ctx: AdminContext, @Param('id') id: string) {
    return this.admin.getDocument(ctx, id);
  }

  @RequireAdminPermission(ADMIN_PERM.VERIFY_DOCUMENTS)
  @Patch('documents/:id/approve')
  approveDocument(
    @CurrentAdmin() ctx: AdminContext,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    return this.admin.approveDocument(ctx, id, req);
  }

  @RequireAdminPermission(ADMIN_PERM.VERIFY_DOCUMENTS)
  @Patch('documents/:id/reject')
  rejectDocument(
    @CurrentAdmin() ctx: AdminContext,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
    @Req() req: Request,
  ) {
    return this.admin.rejectDocument(ctx, id, body, req);
  }

  @RequireAdminPermission(ADMIN_PERM.MANAGE_JOBS)
  @Get('jobs')
  listJobs(
    @CurrentAdmin() ctx: AdminContext,
    @Query() query: Record<string, unknown>,
  ) {
    return this.admin.listJobs(ctx, query);
  }

  @RequireAdminPermission(ADMIN_PERM.VERIFY_JOBS)
  @Get('jobs/pending')
  pendingJobs(
    @CurrentAdmin() ctx: AdminContext,
    @Query() query: Record<string, unknown>,
  ) {
    return this.admin.listPendingJobs(ctx, query);
  }

  @RequireAdminPermission(ADMIN_PERM.MANAGE_JOBS)
  @Get('jobs/rejected')
  rejectedJobs(
    @CurrentAdmin() ctx: AdminContext,
    @Query() query: Record<string, unknown>,
  ) {
    return this.admin.listRejectedJobs(ctx, query);
  }

  @RequireAdminPermission(ADMIN_PERM.VERIFY_JOBS)
  @Patch('jobs/:id/approve')
  approveJob(
    @CurrentAdmin() ctx: AdminContext,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    return this.admin.approveJob(ctx, id, req);
  }

  @RequireAdminPermission(ADMIN_PERM.VERIFY_JOBS)
  @Patch('jobs/:id/reject')
  rejectJob(
    @CurrentAdmin() ctx: AdminContext,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
    @Req() req: Request,
  ) {
    return this.admin.rejectJob(ctx, id, body, req);
  }

  @RequireAdminPermission(ADMIN_PERM.MANAGE_JOBS)
  @Patch('jobs/:id/status')
  jobStatus(
    @CurrentAdmin() ctx: AdminContext,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
    @Req() req: Request,
  ) {
    return this.admin.updateJobStatus(ctx, id, body, req);
  }

  @RequireAdminPermission(ADMIN_PERM.MANAGE_DEPARTMENTS)
  @Get('departments')
  listDepartments(
    @CurrentAdmin() ctx: AdminContext,
    @Query() query: Record<string, unknown>,
  ) {
    return this.admin.listDepartments(ctx, query);
  }

  @RequireAdminPermission(ADMIN_PERM.MANAGE_DEPARTMENTS)
  @Get('departments/:id')
  getDepartment(@CurrentAdmin() ctx: AdminContext, @Param('id') id: string) {
    return this.admin.getDepartment(ctx, id);
  }

  @RequireAdminPermission(ADMIN_PERM.MANAGE_DEPARTMENTS)
  @Post('departments')
  createDepartment(
    @CurrentAdmin() ctx: AdminContext,
    @Body() body: Record<string, unknown>,
    @Req() req: Request,
  ) {
    return this.admin.createDepartment(ctx, body, req);
  }

  @RequireAdminPermission(ADMIN_PERM.MANAGE_DEPARTMENTS)
  @Patch('departments/:id')
  updateDepartment(
    @CurrentAdmin() ctx: AdminContext,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
    @Req() req: Request,
  ) {
    return this.admin.updateDepartment(ctx, id, body, req);
  }

  @RequireAdminPermission(ADMIN_PERM.MANAGE_DEPARTMENTS)
  @Delete('departments/:id')
  deleteDepartment(
    @CurrentAdmin() ctx: AdminContext,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    return this.admin.deleteDepartment(ctx, id, req);
  }

  @RequireAdminPermission(ADMIN_PERM.MANAGE_PLATFORM_USERS)
  @Get('users')
  listUsers(
    @CurrentAdmin() ctx: AdminContext,
    @Query() query: Record<string, unknown>,
  ) {
    return this.admin.listUsers(ctx, query);
  }

  @RequireAdminPermission(ADMIN_PERM.MANAGE_PLATFORM_USERS)
  @Get('users/:id')
  getUser(@CurrentAdmin() ctx: AdminContext, @Param('id') id: string) {
    return this.admin.getUser(ctx, id);
  }

  @RequireAdminPermission(ADMIN_PERM.MANAGE_PLATFORM_USERS)
  @Patch('users/:id/suspend')
  suspendUser(
    @CurrentAdmin() ctx: AdminContext,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    return this.admin.suspendUser(ctx, id, req);
  }

  @RequireAdminPermission(ADMIN_PERM.MANAGE_PLATFORM_USERS)
  @Patch('users/:id/activate')
  activateUser(
    @CurrentAdmin() ctx: AdminContext,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    return this.admin.activateUser(ctx, id, req);
  }

  @RequireAdminPermission(ADMIN_PERM.MANAGE_PLATFORM_USERS)
  @Delete('users/:id')
  deleteUser(
    @CurrentAdmin() ctx: AdminContext,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    return this.admin.deleteUser(ctx, id, req);
  }

  @RequireAdminPermission(ADMIN_PERM.CREATE_PROFILES)
  @Get('profiles')
  listProfiles(
    @CurrentAdmin() ctx: AdminContext,
    @Query() query: Record<string, unknown>,
  ) {
    return this.admin.listProfiles(ctx, query);
  }

  @RequireAdminPermission(ADMIN_PERM.CREATE_PROFILES)
  @Get('profiles/:id')
  getProfile(@CurrentAdmin() ctx: AdminContext, @Param('id') id: string) {
    return this.admin.getProfile(ctx, id);
  }

  @RequireAdminPermission(ADMIN_PERM.CREATE_PROFILES)
  @Post('profiles')
  createProfile(
    @CurrentAdmin() ctx: AdminContext,
    @Body() body: Record<string, unknown>,
    @Req() req: Request,
  ) {
    return this.admin.createProfile(ctx, body, req);
  }

  @RequireAdminPermission(ADMIN_PERM.CREATE_PROFILES)
  @Patch('profiles/:id')
  updateProfile(
    @CurrentAdmin() ctx: AdminContext,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
    @Req() req: Request,
  ) {
    return this.admin.updateProfile(ctx, id, body, req);
  }

  @RequireAdminPermission(ADMIN_PERM.CREATE_PROFILES)
  @Patch('profiles/:id/suspend')
  suspendProfile(
    @CurrentAdmin() ctx: AdminContext,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    return this.admin.suspendProfile(ctx, id, req);
  }

  @RequireAdminPermission(ADMIN_PERM.CREATE_PROFILES)
  @Patch('profiles/:id/activate')
  activateProfile(
    @CurrentAdmin() ctx: AdminContext,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    return this.admin.activateProfile(ctx, id, req);
  }

  @RequireAdminPermission(ADMIN_PERM.CREATE_PROFILES)
  @Delete('profiles/:id')
  deleteProfile(
    @CurrentAdmin() ctx: AdminContext,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    return this.admin.deleteProfile(ctx, id, req);
  }

  @RequireAdminPermission(ADMIN_PERM.RESOLVE_DISPUTES)
  @Get('disputes')
  listDisputes(
    @CurrentAdmin() ctx: AdminContext,
    @Query() query: Record<string, unknown>,
  ) {
    return this.admin.listDisputes(ctx, query);
  }

  @RequireAdminPermission(ADMIN_PERM.RESOLVE_DISPUTES)
  @Get('disputes/:id')
  getDispute(@CurrentAdmin() ctx: AdminContext, @Param('id') id: string) {
    return this.admin.getDispute(ctx, id);
  }

  @RequireAdminPermission(ADMIN_PERM.RESOLVE_DISPUTES)
  @Patch('disputes/:id/resolve')
  resolveDispute(
    @CurrentAdmin() ctx: AdminContext,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
    @Req() req: Request,
  ) {
    return this.admin.resolveDispute(ctx, id, body, req);
  }

  @RequireAdminPermission(ADMIN_PERM.VIEW_FINANCIAL_RECORDS)
  @Get('finance/records')
  financeRecords(
    @CurrentAdmin() ctx: AdminContext,
    @Query() query: Record<string, unknown>,
  ) {
    return this.admin.listFinanceRecords(ctx, query);
  }

  @RequireAdminPermission(ADMIN_PERM.VIEW_FINANCIAL_RECORDS)
  @Get('finance/records/:id')
  financeRecord(@CurrentAdmin() ctx: AdminContext, @Param('id') id: string) {
    return this.admin.getFinanceRecord(ctx, id);
  }

  @RequireAdminPermission(ADMIN_PERM.VIEW_FINANCIAL_RECORDS)
  @Get('finance/summary')
  financeSummary(@CurrentAdmin() ctx: AdminContext) {
    return this.admin.financeSummary(ctx);
  }

  @RequireAdminPermission(ADMIN_PERM.MANAGE_ADMINS)
  @Get('admins')
  listAdmins(
    @CurrentAdmin() ctx: AdminContext,
    @Query() query: Record<string, unknown>,
  ) {
    return this.admin.listAdmins(ctx, query);
  }

  @RequireAdminPermission(ADMIN_PERM.MANAGE_ADMINS)
  @Get('admins/:id')
  getAdmin(@CurrentAdmin() ctx: AdminContext, @Param('id') id: string) {
    return this.admin.getAdmin(ctx, id);
  }

  @RequireAdminPermission(ADMIN_PERM.MANAGE_ADMINS)
  @Post('admins')
  createAdmin(
    @CurrentAdmin() ctx: AdminContext,
    @Body() body: Record<string, unknown>,
    @Req() req: Request,
  ) {
    return this.admin.createAdmin(ctx, body, req);
  }

  @RequireAdminPermission(ADMIN_PERM.MANAGE_ADMINS)
  @Patch('admins/:id')
  updateAdmin(
    @CurrentAdmin() ctx: AdminContext,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
    @Req() req: Request,
  ) {
    return this.admin.updateAdmin(ctx, id, body, req);
  }

  @RequireAdminPermission(ADMIN_PERM.MANAGE_ADMINS)
  @Patch('admins/:id/suspend')
  suspendAdmin(
    @CurrentAdmin() ctx: AdminContext,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    return this.admin.suspendAdmin(ctx, id, req);
  }

  @RequireAdminPermission(ADMIN_PERM.MANAGE_ADMINS)
  @Patch('admins/:id/activate')
  activateAdmin(
    @CurrentAdmin() ctx: AdminContext,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    return this.admin.activateAdmin(ctx, id, req);
  }

  @RequireAdminPermission(ADMIN_PERM.MANAGE_ADMINS)
  @Delete('admins/:id')
  deleteAdmin(
    @CurrentAdmin() ctx: AdminContext,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    return this.admin.deleteAdmin(ctx, id, req);
  }

  @RequireAdminPermission(ADMIN_PERM.MANAGE_ADMINS)
  @Get('permissions')
  listPermissions(
    @CurrentAdmin() ctx: AdminContext,
    @Query() query: Record<string, unknown>,
  ) {
    return this.admin.listPermissions(ctx, query);
  }

  @RequireAdminPermission(ADMIN_PERM.MANAGE_ADMINS)
  @Get('permissions/:adminId')
  getPermissions(
    @CurrentAdmin() ctx: AdminContext,
    @Param('adminId') adminId: string,
  ) {
    return this.admin.getPermissions(ctx, adminId);
  }

  @RequireAdminPermission(ADMIN_PERM.MANAGE_ADMINS)
  @Put('permissions/:adminId')
  replacePermissions(
    @CurrentAdmin() ctx: AdminContext,
    @Param('adminId') adminId: string,
    @Body() body: Record<string, unknown>,
    @Req() req: Request,
  ) {
    return this.admin.replacePermissions(ctx, adminId, body, req);
  }

  @RequireAdminPermission(ADMIN_PERM.MANAGE_ADMINS)
  @Post('permissions/:adminId/grant')
  grantPermission(
    @CurrentAdmin() ctx: AdminContext,
    @Param('adminId') adminId: string,
    @Body() body: Record<string, unknown>,
    @Req() req: Request,
  ) {
    return this.admin.grantPermission(ctx, adminId, body, req);
  }

  @RequireAdminPermission(ADMIN_PERM.MANAGE_ADMINS)
  @Delete('permissions/:adminId/revoke/:permission')
  revokePermission(
    @CurrentAdmin() ctx: AdminContext,
    @Param('adminId') adminId: string,
    @Param('permission') permission: string,
    @Req() req: Request,
  ) {
    return this.admin.revokePermission(ctx, adminId, permission, req);
  }

  @RequireAdminPermission(ADMIN_PERM.MANAGE_ADMINS)
  @Post('permissions/:adminId/departments')
  assignDepartment(
    @CurrentAdmin() ctx: AdminContext,
    @Param('adminId') adminId: string,
    @Body() body: Record<string, unknown>,
    @Req() req: Request,
  ) {
    return this.admin.assignDepartment(ctx, adminId, body, req);
  }

  @RequireAdminPermission(ADMIN_PERM.MANAGE_ADMINS)
  @Delete('permissions/:adminId/departments/:deptId')
  unassignDepartment(
    @CurrentAdmin() ctx: AdminContext,
    @Param('adminId') adminId: string,
    @Param('deptId') deptId: string,
    @Req() req: Request,
  ) {
    return this.admin.unassignDepartment(ctx, adminId, deptId, req);
  }
}
