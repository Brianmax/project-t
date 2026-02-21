import { IsNotEmpty, IsNumber, IsString, IsUUID } from 'class-validator';

export class CreateExtraChargeDto {
  @IsString()
  @IsNotEmpty()
  description: string;

  @IsNumber()
  @IsNotEmpty()
  amount: number;

  @IsNumber()
  @IsNotEmpty()
  month: number;

  @IsNumber()
  @IsNotEmpty()
  year: number;

  @IsUUID()
  @IsNotEmpty()
  contractId: string;
}
