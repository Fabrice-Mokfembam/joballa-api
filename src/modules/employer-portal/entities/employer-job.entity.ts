import type { EmployerProfile, Job } from '@prisma/client';
import {
  jobStatusToApi,
  type EmployerJobStatusApi,
} from '../utils/employer-job-status.util';
import {
  jobTypeToDisplay,
  payStructureToPer,
} from '../utils/employer-job-type.util';

export type EmployerJobCounts = {
  applicationsCount: number;
  shortlistedCount: number;
};

export interface EmployerJobListItemEntity {
  jobId: string;
  title: string;
  location: string;
  jobType: string;
  salary: string;
  status: EmployerJobStatusApi;
  applicantsCount: number;
  shortlistedCount: number;
  postedAt: string;
}

export interface EmployerJobDetailEntity extends EmployerJobListItemEntity {
  company: { name: string; logo: string | null };
  pay: number;
  currency: string;
  per: string;
  daysPerWeek: number | null;
  startDate: string;
  duration: string | null;
  description: string;
  requirements: string[];
  responsibilities: string[];
  city: string | null;
  neighbourhood: string | null;
  requiredSkills: string[];
  requiredLevel: string | null;
  numberOfOpenings: number;
}

function formatSalary(pay: number, currency: string, per: string): string {
  const rounded = Math.round(pay);
  return `${rounded.toLocaleString('en-US')} ${currency}/${per.toLowerCase()}`;
}

function formatLocation(job: Job): string {
  const parts = [job.neighbourhood, job.city, job.location].filter(Boolean);
  const unique = [...new Set(parts)];
  return unique.join(', ') || job.location;
}

function formatStartDate(job: Job): string {
  if (job.startAsap) {
    return 'As soon as possible';
  }
  if (job.startDate) {
    return job.startDate.toISOString().slice(0, 10);
  }
  return 'TBD';
}

function formatDuration(job: Job): string | null {
  if (job.durationValue && job.durationUnit) {
    return `${job.durationValue} ${job.durationUnit.toLowerCase()}`;
  }
  return null;
}

export function toEmployerJobListItem(
  job: Job,
  counts: EmployerJobCounts,
): EmployerJobListItemEntity {
  const pay = Number(job.payRate);
  const per = payStructureToPer(job.payStructure);
  return {
    jobId: job.id,
    title: job.title,
    location: formatLocation(job),
    jobType: jobTypeToDisplay(job.jobType),
    salary: formatSalary(pay, job.currency, per),
    status: jobStatusToApi(job.status),
    applicantsCount: counts.applicationsCount,
    shortlistedCount: counts.shortlistedCount,
    postedAt: job.createdAt.toISOString(),
  };
}

export function toEmployerJobDetail(
  job: Job,
  employer: EmployerProfile,
  counts: EmployerJobCounts,
): EmployerJobDetailEntity {
  const pay = Number(job.payRate);
  const per = payStructureToPer(job.payStructure);
  const base = toEmployerJobListItem(job, counts);
  return {
    ...base,
    company: {
      name: employer.companyName,
      logo: employer.logoUrl,
    },
    pay,
    currency: job.currency,
    per,
    daysPerWeek: null,
    startDate: formatStartDate(job),
    duration: formatDuration(job),
    description: job.description,
    requirements:
      job.requirements.length > 0 ? job.requirements : job.requiredSkills,
    responsibilities: job.responsibilities,
    city: job.city,
    neighbourhood: job.neighbourhood,
    requiredSkills: job.requiredSkills,
    requiredLevel: job.requiredLevel,
    numberOfOpenings: job.numberOfOpenings,
  };
}
