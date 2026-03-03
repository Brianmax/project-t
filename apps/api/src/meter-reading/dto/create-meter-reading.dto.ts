import { IsDateString, IsInt, IsNotEmpty, IsNumber, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class CreateMeterReadingDto {
  @IsNumber()
  @IsNotEmpty()
  reading: number;

  @IsDateString()
  @IsNotEmpty()
  date: string;

  @IsUUID()
  @IsNotEmpty()
  departmentMeterId: string;

  @IsInt()
  @Min(1)
  @Max(12)
  @IsOptional()
  billingMonth?: number;

  @IsInt()
  @IsOptional()
  billingYear?: number;
}
