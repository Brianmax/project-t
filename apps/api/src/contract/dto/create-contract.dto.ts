import { IsDateString, IsNotEmpty, IsNumber } from 'class-validator';

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

  @IsNumber()
  @IsNotEmpty()
  tenantId: number;

  @IsNumber()
  @IsNotEmpty()
  departmentId: number;
}
