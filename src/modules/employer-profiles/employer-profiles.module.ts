import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { UsersModule } from '../users/users.module';
import { EmployerProfilesController } from './controllers/employer-profiles.controller';
import { EmployerProfilesRepository } from './repositories/employer-profiles.repository';
import { EmployerProfilesService } from './services/employer-profiles.service';

@Module({
  imports: [PrismaModule, UsersModule],
  controllers: [EmployerProfilesController],
  providers: [EmployerProfilesRepository, EmployerProfilesService],
  exports: [EmployerProfilesService, EmployerProfilesRepository],
})
export class EmployerProfilesModule {}
