import { Module } from '@nestjs/common';
import { EngagementsController } from './controllers/engagements.controller';
import { EngagementsService } from './services/engagements.service';
import { EngagementsRepository } from './repositories/engagements.repository';
import { PrismaModule } from '../../prisma/prisma.module';
import { WorkersModule } from '../workers/workers.module';

@Module({
  imports: [PrismaModule, WorkersModule],
  controllers: [EngagementsController],
  providers: [EngagementsService, EngagementsRepository],
})
export class EngagementsModule {}
