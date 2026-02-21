import {
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
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

  @IsUUID()
  @IsNotEmpty()
  propertyId: string;

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
