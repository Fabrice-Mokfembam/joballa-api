import { Injectable, NotFoundException } from '@nestjs/common';
import { EarningsRepository } from '../repositories/earnings.repository';
import { EarningsFilterDto } from '../dto/earnings.dto';

@Injectable()
export class EarningsService {
  constructor(private readonly earningsRepository: EarningsRepository) {}

  getSummary(workerId: string) {
    return this.earningsRepository.getEarningsSummary(workerId);
  }

  getTransactions(workerId: string, dto: EarningsFilterDto) {
    return this.earningsRepository.getTransactions(workerId, dto);
  }

  async getTransactionById(workerId: string, transactionId: string) {
    const row = await this.earningsRepository.getTransactionById(
      workerId,
      transactionId,
    );
    if (!row) {
      throw new NotFoundException('Transaction not found');
    }
    return row;
  }

  getStatement(workerId: string, from?: string, to?: string) {
    return this.earningsRepository.getStatement(workerId, from, to);
  }
}
