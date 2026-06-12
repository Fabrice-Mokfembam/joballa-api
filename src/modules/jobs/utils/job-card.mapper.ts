import type { JobStatus, Prisma } from '@prisma/client';

type JobCardRow = {
  id: string;
  title: string;
  description: string;
  category: string;
  jobType: string;
  workMode: string;
  location: string;
  city: string | null;
  region: string | null;
  neighbourhood: string | null;
  payRate: Prisma.Decimal | number | string;
  payStructure: string;
  currency: string;
  numberOfOpenings: number;
  requiredSkills: string[];
  requiredLevel: string | null;
  startAsap: boolean;
  startDate: Date | null;
  durationValue: number | null;
  durationUnit: string | null;
  status: JobStatus;
  createdAt: Date;
  employer: {
    id: string;
    companyName: string;
    logoUrl: string | null;
    isJoballaDepartment: boolean;
    verificationStatus: string;
  };
  _count?: { applications: number };
};

function slugify(title: string, city: string | null): string {
  const base = `${title}-${city ?? 'cameroon'}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return base.slice(0, 80) || 'job';
}

function formatDuration(
  value: number | null,
  unit: string | null,
): string | null {
  if (value == null || !unit) return null;
  const u = unit.toLowerCase();
  return `${value} ${u}`;
}

export function mapJobCard(
  job: JobCardRow,
  ctx?: {
    savedJobIds?: Set<string>;
    appliedByJobId?: Map<string, string>;
  },
) {
  const applicationId = ctx?.appliedByJobId?.get(job.id) ?? null;
  return {
    id: job.id,
    slug: slugify(job.title, job.city),
    title: job.title,
    description: job.description,
    companyName: job.employer.companyName,
    companyLogoUrl: job.employer.logoUrl,
    city: job.city,
    region: job.region,
    neighbourhood: job.neighbourhood,
    category: job.category,
    jobType: job.jobType,
    workMode: job.workMode,
    payStructure: job.payStructure,
    payRate: Number(job.payRate),
    currency: job.currency,
    requiredLevel: job.requiredLevel,
    requiredSkills: job.requiredSkills,
    durationValue: job.durationValue,
    durationUnit: job.durationUnit,
    duration: formatDuration(job.durationValue, job.durationUnit),
    numberOfOpenings: job.numberOfOpenings,
    startDate: job.startDate?.toISOString().slice(0, 10) ?? null,
    startAsap: job.startAsap,
    status: job.status,
    applicationCount: job._count?.applications ?? 0,
    postedAt: job.createdAt.toISOString(),
    createdAt: job.createdAt.toISOString(),
    saved: ctx?.savedJobIds?.has(job.id) ?? false,
    hasApplied: Boolean(applicationId),
    applicationId,
    employer: {
      id: job.employer.id,
      companyName: job.employer.companyName,
      logoUrl: job.employer.logoUrl,
    },
  };
}
