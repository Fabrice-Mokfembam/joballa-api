import { IsIn, IsString } from 'class-validator';

const STATUSES = [
  'draft',
  'pending_review',
  'live',
  'paused',
  'closed',
] as const;

export class UpdateJobStatusDto {
  @IsString()
  @IsIn([...STATUSES])
  status!: (typeof STATUSES)[number];
}
