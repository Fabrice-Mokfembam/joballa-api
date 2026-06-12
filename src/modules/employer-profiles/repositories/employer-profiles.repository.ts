import { Injectable } from '@nestjs/common';
import { Prisma, type EmployerProfile } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class EmployerProfilesRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByUserId(userId: string): Promise<EmployerProfile | null> {
    return this.prisma.employerProfile.findUnique({
      where: { userId },
    });
  }

  createForUser(userId: string, companyName: string): Promise<EmployerProfile> {
    return this.prisma.employerProfile.create({
      data: {
        userId,
        companyName,
      },
    });
  }

  updateByUserId(
    userId: string,
    data: Prisma.EmployerProfileUpdateInput,
  ): Promise<EmployerProfile> {
    return this.prisma.employerProfile.update({
      where: { userId },
      data,
    });
  }
}
