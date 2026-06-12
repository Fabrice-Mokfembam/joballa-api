import { Module } from '@nestjs/common';
import { SavedJobsController } from './controllers/saved-jobs.controller';
import { SavedJobsService } from './services/saved-jobs.service';
import { SavedJobsRepository } from './repositories/saved-jobs.repository';
import { PrismaModule } from '../../prisma/prisma.module';
import { WorkersModule } from '../workers/workers.module';

@Module({
  imports: [PrismaModule, WorkersModule],
  controllers: [SavedJobsController],
  providers: [SavedJobsService, SavedJobsRepository],
})
export class SavedJobsModule {}
