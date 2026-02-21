import { IsDateString, IsNotEmpty, IsNumber, IsUUID } from 'class-validator';

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
}
