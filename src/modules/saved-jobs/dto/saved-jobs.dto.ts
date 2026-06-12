import { IsArray, IsString } from 'class-validator';

export class BulkDeleteSavedJobsDto {
  @IsArray()
  @IsString({ each: true })
  jobIds!: string[];
}
