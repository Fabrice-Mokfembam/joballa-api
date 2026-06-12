import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../prisma/prisma.module';
import { FilesModule } from '../../files/files.module';
import { EmployerV2Controller } from './employer-v2.controller';
import { EmployerV2Service } from './employer-v2.service';

@Module({
  imports: [PrismaModule, FilesModule],
  controllers: [EmployerV2Controller],
  providers: [EmployerV2Service],
})
export class EmployerV2Module {}
