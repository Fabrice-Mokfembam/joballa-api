import { Module } from '@nestjs/common';
import { ApplicationsController } from './controllers/applications.controller';
import { ApplicationsService } from './services/applications.service';
import { ApplicationsRepository } from './repositories/applications.repository';
import { WorkersRepository } from '../workers/repositories/workers.repository';
import { WorkersModule } from '../workers/workers.module';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule, WorkersModule],
  controllers: [ApplicationsController],
  providers: [
    ApplicationsService,
    ApplicationsRepository,
    WorkersRepository, // needed for profile snapshot + completeness guard
  ],
})
export class ApplicationsModule {}
