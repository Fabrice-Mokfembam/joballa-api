import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PaymentStatus, Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import type { LocalAuthUser } from '../../../common/types/auth-context.type';
import type { PayWorkerDto } from '../dto/pay-worker.dto';
import type { PaymentHistoryQueryDto } from '../dto/payment-history-query.dto';
import type { PaymentStatementQueryDto } from '../dto/payment-statement-query.dto';
import type { PaymentsPeriodQueryDto } from '../dto/payments-query.dto';
import { EmployerPaymentsRepository } from '../repositories/employer-payments.repository';
import { EmployerWorkforceRepository } from '../repositories/employer-workforce.repository';
import {
  momoProviderToApi,
  parseMomoProvider,
} from '../utils/momo-provider.util';
import { parsePayPeriod, periodLabel } from '../utils/pay-period.util';
import { payStructureToPer } from '../utils/employer-job-type.util';
import { EmployerContextService } from './employer-context.service';

@Injectable()
export class EmployerPaymentsService {
  constructor(
    private readonly employerContext: EmployerContextService,
    private readonly paymentsRepository: EmployerPaymentsRepository,
    private readonly workforceRepository: EmployerWorkforceRepository,
  ) {}

  async getSummary(authUser: LocalAuthUser, query: PaymentsPeriodQueryDto) {
    const { profile } =
      await this.employerContext.requireEmployerProfile(authUser);
    const period = parsePayPeriod(query.month, query.year);
    const workers = await this.buildWorkerPayRows(profile.id, period);
    const payments = await this.paymentsRepository.paymentsForPeriod(
      profile.id,
      period,
    );

    const totalPayroll = workers.reduce((s, w) => s + w.amountOwed, 0);
    const completed = payments.filter(
      (p) => p.status === PaymentStatus.COMPLETED,
    );
    const paidAmount = completed.reduce((s, p) => s + Number(p.amount), 0);
    const outstanding = Math.max(0, totalPayroll - paidAmount);

    const [y, m] = period.split('-').map(Number);
    const dueDate = new Date(y, m, 0);
    const now = new Date();
    const daysRemaining = Math.max(
      0,
      Math.ceil((dueDate.getTime() - now.getTime()) / 86_400_000),
    );

    return {
      period,
      totalPayroll: { amount: totalPayroll, workerCount: workers.length },
      paid: {
        amount: paidAmount,
        sentCount: completed.length,
      },
      outstanding: {
        amount: outstanding,
        pendingCount: workers.filter((w) => w.paymentStatus === 'unpaid')
          .length,
      },
      dueDate: {
        date: dueDate.toISOString().slice(0, 10),
        daysRemaining,
      },
    };
  }

  async getWorkersTable(
    authUser: LocalAuthUser,
    query: PaymentsPeriodQueryDto,
  ) {
    const { profile } =
      await this.employerContext.requireEmployerProfile(authUser);
    const period = parsePayPeriod(query.month, query.year);
    const items = await this.buildWorkerPayRows(profile.id, period);
    return { period, items };
  }

  async payWorker(authUser: LocalAuthUser, dto: PayWorkerDto) {
    const { profile } =
      await this.employerContext.requireEmployerProfile(authUser);

    const engagement = await this.workforceRepository.findEngagementForEmployer(
      dto.workerId,
      profile.id,
    );
    if (!engagement) {
      throw new BadRequestException(
        'Worker must be hired (active engagement) before payment.',
      );
    }

    const provider = parseMomoProvider(dto.provider);
    const payment = await this.paymentsRepository.createPayment({
      engagement: { connect: { id: engagement.id } },
      worker: { connect: { id: dto.workerId } },
      employer: { connect: { id: profile.id } },
      amount: dto.amount,
      currency: dto.currency?.trim() || 'XAF',
      mobileMoneyProvider: provider,
      recipientNumber: dto.phone,
      payPeriod: dto.period,
      idempotencyKey: randomUUID(),
      status: PaymentStatus.PENDING,
    });

    return {
      paymentId: payment.id,
      status: payment.status.toLowerCase(),
      message:
        'Payment initiated and queued. MoMo/OM confirmation will update status when integrated.',
    };
  }

  async getHistory(authUser: LocalAuthUser, query: PaymentHistoryQueryDto) {
    const { profile } =
      await this.employerContext.requireEmployerProfile(authUser);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const where: Prisma.PaymentWhereInput = {};
    if (query.search?.trim()) {
      const term = query.search.trim();
      where.OR = [
        { worker: { fullName: { contains: term, mode: 'insensitive' } } },
        {
          engagement: {
            job: { title: { contains: term, mode: 'insensitive' } },
          },
        },
      ];
    }

    const { items, total } = await this.paymentsRepository.listHistory(
      profile.id,
      {
        where,
        skip: (page - 1) * limit,
        take: limit,
      },
    );

    return {
      items: items.map((p) => this.toHistoryItem(p)),
      total,
      page,
      limit,
    };
  }

  async getPayment(authUser: LocalAuthUser, paymentId: string) {
    const { profile } =
      await this.employerContext.requireEmployerProfile(authUser);
    const payment = await this.paymentsRepository.findPaymentForEmployer(
      paymentId,
      profile.id,
    );
    if (!payment) {
      throw new NotFoundException('Payment not found.');
    }
    return this.toHistoryItem(payment);
  }

  async getStatement(authUser: LocalAuthUser, query: PaymentStatementQueryDto) {
    const { profile } =
      await this.employerContext.requireEmployerProfile(authUser);
    const from = new Date(query.from);
    const to = new Date(query.to);
    if (to < from) {
      throw new BadRequestException('`to` must be on or after `from`.');
    }

    const payments = await this.paymentsRepository.paymentsBetween(
      profile.id,
      from,
      to,
    );

    const rows = payments.map((p) => this.toHistoryItem(p));
    const totalAmount = rows.reduce((s, r) => s + r.amount, 0);

    return {
      from: query.from,
      to: query.to,
      format: 'json',
      message:
        'PDF export can be added later; use this payload for payroll statement rendering.',
      totalAmount,
      rows,
    };
  }

  private async buildWorkerPayRows(employerProfileId: string, period: string) {
    const engagements =
      await this.paymentsRepository.listActiveEngagements(employerProfileId);
    const periodPayments = await this.paymentsRepository.paymentsForPeriod(
      employerProfileId,
      period,
    );

    const paidWorkerIds = new Set(
      periodPayments
        .filter((p) => p.status === PaymentStatus.COMPLETED)
        .map((p) => p.workerId),
    );

    return engagements.map((e) => {
      const rate = Number(e.agreedRate);
      const paid = paidWorkerIds.has(e.workerId);
      return {
        workerId: e.workerId,
        name: e.worker.fullName,
        avatar: null,
        role: e.job.title,
        rateXAF: rate,
        per: payStructureToPer(e.payStructure).toLowerCase(),
        amountOwed: paid ? 0 : rate,
        paymentStatus: paid ? 'paid' : 'unpaid',
        preferredProvider: e.worker.mobileMoneyProvider
          ? momoProviderToApi(e.worker.mobileMoneyProvider)
          : 'MoMo',
        phone: e.worker.mobileMoneyNumber ?? '',
        period,
        periodLabel: periodLabel(period),
      };
    });
  }

  private toHistoryItem(payment: {
    id: string;
    amount: { toString(): string } | number;
    currency: string;
    mobileMoneyProvider: Parameters<typeof momoProviderToApi>[0];
    initiatedAt: Date;
    status: PaymentStatus;
    payPeriod: string | null;
    worker: { fullName: string };
    engagement: { job: { title: string } };
  }) {
    return {
      paymentId: payment.id,
      workerName: payment.worker.fullName,
      role: payment.engagement.job.title,
      period: payment.payPeriod ? periodLabel(payment.payPeriod) : null,
      date: payment.initiatedAt.toISOString().slice(0, 10),
      amount: Number(payment.amount),
      currency: payment.currency,
      provider: momoProviderToApi(payment.mobileMoneyProvider),
      status: payment.status.toLowerCase(),
    };
  }
}
