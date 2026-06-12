import { Injectable } from '@nestjs/common';
import { ApplicationStatus, Prisma, type Application } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

const applicationInclude = {
  job: true,
  worker: true,
} satisfies Prisma.ApplicationInclude;

export type ApplicationWithRelations = Prisma.ApplicationGetPayload<{
  include: typeof applicationInclude;
}>;

@Injectable()
export class EmployerApplicantsRepository {
  constructor(private readonly prisma: PrismaService) {}

  listForEmployer(
    employerProfileId: string,
    params: {
      where: Prisma.ApplicationWhereInput;
      skip: number;
      take: number;
      orderBy: Prisma.ApplicationOrderByWithRelationInput;
    },
  ): Promise<{ items: ApplicationWithRelations[]; total: number }> {
    const where: Prisma.ApplicationWhereInput = {
      ...params.where,
      job: { employerId: employerProfileId },
    };

    return this.prisma.$transaction(async (tx) => {
      const [items, total] = await Promise.all([
        tx.application.findMany({
          where,
          include: applicationInclude,
          skip: params.skip,
          take: params.take,
          orderBy: params.orderBy,
        }),
        tx.application.count({ where }),
      ]);
      return { items, total };
    });
  }

  findByIdForEmployer(
    applicationId: string,
    employerProfileId: string,
  ): Promise<ApplicationWithRelations | null> {
    return this.prisma.application.findFirst({
      where: {
        id: applicationId,
        job: { employerId: employerProfileId },
      },
      include: applicationInclude,
    });
  }

  updateStatus(
    applicationId: string,
    status: ApplicationStatus,
  ): Promise<Application> {
    return this.prisma.application.update({
      where: { id: applicationId },
      data: { status },
    });
  }

  updateNotes(
    applicationId: string,
    employerNotes: string,
  ): Promise<ApplicationWithRelations> {
    return this.prisma.application.update({
      where: { id: applicationId },
      data: { employerNotes },
      include: applicationInclude,
    });
  }

  distinctJobTitles(employerProfileId: string): Promise<string[]> {
    return this.prisma.job
      .findMany({
        where: { employerId: employerProfileId },
        select: { title: true },
        distinct: ['title'],
        orderBy: { title: 'asc' },
      })
      .then((rows) => rows.map((r) => r.title));
  }
}
