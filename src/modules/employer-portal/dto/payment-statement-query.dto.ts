import { IsDateString } from 'class-validator';

export class PaymentStatementQueryDto {
  @IsDateString()
  from!: string;

  @IsDateString()
  to!: string;
}
