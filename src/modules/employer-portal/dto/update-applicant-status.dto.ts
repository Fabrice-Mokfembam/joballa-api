import { IsIn, IsString } from 'class-validator';

export class UpdateApplicantStatusDto {
  @IsString()
  @IsIn(['pending', 'shortlisted', 'rejected', 'hired'])
  status!: 'pending' | 'shortlisted' | 'rejected' | 'hired';
}
