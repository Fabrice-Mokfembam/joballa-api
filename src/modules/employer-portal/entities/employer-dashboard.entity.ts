export interface EmployerDashboardStat {
  count: number | string;
  label?: string;
  trend?: string;
}

export interface EmployerDashboardJobCard {
  jobId: string;
  title: string;
  location: string;
  jobType: string;
  salary: string;
  status: string;
  applicantsCount: number;
  shortlistedCount: number;
  postedAt: string;
}

export interface EmployerDashboardEntity {
  activeJobs: EmployerDashboardStat;
  totalApplicants: EmployerDashboardStat;
  hiredWorkers: EmployerDashboardStat;
  totalPayroll: EmployerDashboardStat;
  recentApplicants?: unknown[];
  liveJobs?: EmployerDashboardJobCard[];
}
