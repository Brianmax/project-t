import { IsDateString, IsNotEmpty, IsNumber } from 'class-validator';

export class CreateMeterReadingDto {
  @IsNumber()
  @IsNotEmpty()
  reading: number;

  @IsDateString()
  @IsNotEmpty()
  date: string;

  @IsNumber()
  @IsNotEmpty()
  departmentMeterId: number;
}
