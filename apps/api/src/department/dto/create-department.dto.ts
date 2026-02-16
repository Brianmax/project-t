import {
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateDepartmentDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsNumber()
  @IsNotEmpty()
  floor: number;

  @IsNumber()
  @IsNotEmpty()
  numberOfRooms: number;

  @IsNumber()
  @IsNotEmpty()
  propertyId: number;

  @IsNumber()
  @IsOptional()
  initialWaterReading?: number;

  @IsDateString()
  @IsOptional()
  initialWaterReadingDate?: string;

  @IsNumber()
  @IsOptional()
  initialElectricityReading?: number;

  @IsDateString()
  @IsOptional()
  initialElectricityReadingDate?: string;
}
