import { IsDateString, IsEnum, IsOptional } from 'class-validator';
import { PaymentMethod } from '../../entities/payment.entity';

export class PaymentReportQueryDto {
  @IsDateString()
  @IsOptional()
  from?: string;

  @IsDateString()
  @IsOptional()
  to?: string;

  @IsEnum(PaymentMethod)
  @IsOptional()
  method?: PaymentMethod;
}
