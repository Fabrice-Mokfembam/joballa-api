import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class SavedJobsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getSavedJobs(workerId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.savedJob.findMany({
        where: { workerId },
        skip,
        take: limit,
        orderBy: { savedAt: 'desc' },
        include: {
          job: {
            select: {
              id: true,
              title: true,
              category: true,
              jobType: true,
              workMode: true,
              location: true,
              city: true,
              payRate: true,
              payStructure: true,
              currency: true,
              status: true,
              startAsap: true,
              startDate: true,
              requiredSkills: true,
              numberOfOpenings: true,
              createdAt: true,
              employer: {
                select: {
                  id: true,
                  companyName: true,
                  logoUrl: true,
                  verificationStatus: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.savedJob.count({ where: { workerId } }),
    ]);

    return { items, total, page, limit };
  }

  async deleteSavedJob(workerId: string, jobId: string) {
    return this.prisma.savedJob.delete({
      where: { workerId_jobId: { workerId, jobId } },
    });
  }

  async deleteSavedJobsInBulk(workerId: string, jobIds: string[]) {
    return this.prisma.savedJob.deleteMany({
      where: { workerId, jobId: { in: jobIds } },
    });
  }
}
