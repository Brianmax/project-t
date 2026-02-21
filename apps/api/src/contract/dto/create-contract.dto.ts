import { IsDateString, IsNotEmpty, IsNumber, IsUUID } from 'class-validator';

export class CreateContractDto {
  @IsDateString()
  @IsNotEmpty()
  startDate: string;

  @IsDateString()
  @IsNotEmpty()
  endDate: string;

  @IsNumber()
  @IsNotEmpty()
  rentAmount: number;

  @IsNumber()
  @IsNotEmpty()
  advancePayment: number;

  @IsNumber()
  @IsNotEmpty()
  guaranteeDeposit: number;

  @IsUUID()
  @IsNotEmpty()
  tenantId: string;

  @IsUUID()
  @IsNotEmpty()
  departmentId: string;
}
