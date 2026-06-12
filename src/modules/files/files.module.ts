import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CloudinaryProvider } from './cloudinary.provider';
import { FilesService } from './services/files.service';
import { FilesController } from './controllers/files.controller';

@Module({
  imports: [ConfigModule],
  controllers: [FilesController],
  providers: [CloudinaryProvider, FilesService],
  exports: [FilesService], // exported so other modules can inject it
})
export class FilesModule {}
