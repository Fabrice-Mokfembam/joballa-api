import { IsString, MaxLength } from 'class-validator';

export class UpdateApplicantNotesDto {
  @IsString()
  @MaxLength(5000)
  employerNotes!: string;
}
