import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  /** Accept `email` from admin UI as an alias for `identifier`. */
  @Transform(({ obj }: { obj: { identifier?: string; email?: string } }) =>
    (obj.identifier ?? obj.email ?? '').trim(),
  )
  @IsString()
  @MaxLength(255)
  identifier!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  email?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(128)
  password!: string;
}
