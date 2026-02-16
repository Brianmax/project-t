import { IsEnum } from 'class-validator';
import { ReceiptStatus } from '../../receipt/entities/receipt.entity';

export class UpdateReceiptStatusDto {
  @IsEnum(ReceiptStatus)
  status: ReceiptStatus;
}
