import { Injectable } from '@nestjs/common';
import {
  EngagementStatus,
  PaymentStatus,
  Prisma,
  type Payment,
} from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

const paymentInclude = {
  worker: true,
  engagement: { include: { job: true } },
} satisfies Prisma.PaymentInclude;

export type PaymentWithRelations = Prisma.PaymentGetPayload<{
  include: typeof paymentInclude;
}>;

@Injectable()
export class EmployerPaymentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  listActiveEngagements(employerProfileId: string) {
    return this.prisma.workEngagement.findMany({
      where: {
        employerId: employerProfileId,
        status: EngagementStatus.ACTIVE,
      },
      include: { worker: true, job: true },
    });
  }

  paymentsForPeriod(
    employerProfileId: string,
    payPeriod: string,
  ): Promise<Payment[]> {
    return this.prisma.payment.findMany({
      where: {
        employerId: employerProfileId,
        payPeriod,
        archivedAt: null,
      },
    });
  }

  createPayment(data: Prisma.PaymentCreateInput): Promise<Payment> {
    return this.prisma.payment.create({ data });
  }

  findPaymentForEmployer(
    paymentId: string,
    employerProfileId: string,
  ): Promise<PaymentWithRelations | null> {
    return this.prisma.payment.findFirst({
      where: {
        id: paymentId,
        employerId: employerProfileId,
        archivedAt: null,
      },
      include: paymentInclude,
    });
  }

  listHistory(
    employerProfileId: string,
    params: {
      where: Prisma.PaymentWhereInput;
      skip: number;
      take: number;
    },
  ): Promise<{ items: PaymentWithRelations[]; total: number }> {
    const where: Prisma.PaymentWhereInput = {
      ...params.where,
      employerId: employerProfileId,
      archivedAt: null,
    };

    return this.prisma.$transaction(async (tx) => {
      const [items, total] = await Promise.all([
        tx.payment.findMany({
          where,
          include: paymentInclude,
          skip: params.skip,
          take: params.take,
          orderBy: { initiatedAt: 'desc' },
        }),
        tx.payment.count({ where }),
      ]);
      return { items, total };
    });
  }

  paymentsBetween(
    employerProfileId: string,
    from: Date,
    to: Date,
  ): Promise<PaymentWithRelations[]> {
    return this.prisma.payment.findMany({
      where: {
        employerId: employerProfileId,
        archivedAt: null,
        initiatedAt: { gte: from, lte: to },
      },
      include: paymentInclude,
      orderBy: { initiatedAt: 'asc' },
    });
  }
}
