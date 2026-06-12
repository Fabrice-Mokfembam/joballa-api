import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { PaymentStatus, Prisma } from '@prisma/client';
import { EarningsFilterDto } from '../dto/earnings.dto';

@Injectable()
export class EarningsRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ─────────────────────────────────────────────────────────────────────────
  // SUMMARY
  // ─────────────────────────────────────────────────────────────────────────

  async getEarningsSummary(workerId: string) {
    const [allTime, pending, thisMonth] = await this.prisma.$transaction([
      // Total completed earnings all time
      this.prisma.payment.aggregate({
        where: { workerId, status: PaymentStatus.COMPLETED },
        _sum: { amount: true },
        _count: { id: true },
      }),
      // Pending — awaiting disbursement
      this.prisma.payment.aggregate({
        where: { workerId, status: PaymentStatus.PENDING },
        _sum: { amount: true },
      }),
      // This calendar month
      this.prisma.payment.aggregate({
        where: {
          workerId,
          status: PaymentStatus.COMPLETED,
          confirmedAt: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
          },
        },
        _sum: { amount: true },
      }),
    ]);

    return {
      totalEarned: allTime._sum.amount ?? 0,
      totalPayments: allTime._count.id,
      pendingAmount: pending._sum.amount ?? 0,
      thisMonthTotal: thisMonth._sum.amount ?? 0,
      currency: 'XAF',
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TRANSACTIONS
  // ─────────────────────────────────────────────────────────────────────────

  async getTransactions(workerId: string, dto: EarningsFilterDto) {
    const { page = 1, limit = 20 } = dto;
    const skip = (page - 1) * limit;

    const where: Prisma.PaymentWhereInput = {
      workerId,
      archivedAt: null,
      ...(dto.status && { status: dto.status as PaymentStatus }),
      ...(dto.engagementId && { engagementId: dto.engagementId }),
      ...((dto.from || dto.to) && {
        initiatedAt: {
          ...(dto.from && { gte: new Date(dto.from) }),
          ...(dto.to && { lte: new Date(dto.to) }),
        },
      }),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.payment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { initiatedAt: 'desc' },
        select: {
          id: true,
          amount: true,
          currency: true,
          status: true,
          mobileMoneyProvider: true,
          recipientNumber: true,
          payPeriod: true,
          initiatedAt: true,
          confirmedAt: true,
          failureReason: true,
          engagement: {
            select: {
              id: true,
              job: { select: { id: true, title: true } },
              employer: { select: { companyName: true, logoUrl: true } },
            },
          },
        },
      }),
      this.prisma.payment.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async getTransactionById(workerId: string, transactionId: string) {
    return this.prisma.payment.findFirst({
      where: { id: transactionId, workerId, archivedAt: null },
      select: {
        id: true,
        amount: true,
        currency: true,
        status: true,
        mobileMoneyProvider: true,
        recipientNumber: true,
        payPeriod: true,
        initiatedAt: true,
        confirmedAt: true,
        failureReason: true,
        engagement: {
          select: {
            id: true,
            job: { select: { id: true, title: true } },
            employer: { select: { companyName: true, logoUrl: true } },
          },
        },
      },
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // STATEMENT (for export — all completed payments in range)
  // ─────────────────────────────────────────────────────────────────────────

  async getStatement(workerId: string, from?: string, to?: string) {
    return this.prisma.payment.findMany({
      where: {
        workerId,
        status: PaymentStatus.COMPLETED,
        ...((from || to) && {
          confirmedAt: {
            ...(from && { gte: new Date(from) }),
            ...(to && { lte: new Date(to) }),
          },
        }),
      },
      orderBy: { confirmedAt: 'desc' },
      select: {
        id: true,
        amount: true,
        currency: true,
        mobileMoneyProvider: true,
        payPeriod: true,
        confirmedAt: true,
        engagement: {
          select: {
            job: { select: { title: true } },
            employer: { select: { companyName: true } },
          },
        },
      },
    });
  }
}
