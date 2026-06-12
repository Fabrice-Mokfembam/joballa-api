import { Module } from '@nestjs/common';
import { EarningsController } from './controllers/earnings.controller';
import { EarningsService } from './services/earnings.service';
import { EarningsRepository } from './repositories/earnings.repository';
import { PrismaModule } from '../../prisma/prisma.module';
import { WorkersModule } from '../workers/workers.module';

@Module({
  imports: [PrismaModule, WorkersModule],
  controllers: [EarningsController],
  providers: [EarningsService, EarningsRepository],
})
export class EarningsModule {}
