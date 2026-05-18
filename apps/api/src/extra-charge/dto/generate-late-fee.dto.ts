import { IsNotEmpty, IsNumber, IsUUID, Min } from 'class-validator';

export class GenerateLateFeeDto {
  @IsUUID()
  @IsNotEmpty()
  contractId: string;

  @IsNumber()
  @IsNotEmpty()
  month: number;

  @IsNumber()
  @IsNotEmpty()
  year: number;

  @IsNumber()
  @Min(0)
  @IsNotEmpty()
  ratePerDay: number;
}
