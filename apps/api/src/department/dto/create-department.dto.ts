import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
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
  @Min(0)
  initialWaterReading: number;

  @IsDateString()
  @IsNotEmpty()
  initialWaterReadingDate: string;

  @IsNumber()
  @Min(0)
  initialElectricityReading: number;

  @IsDateString()
  @IsNotEmpty()
  initialElectricityReadingDate: string;

  @IsInt()
  @Min(1)
  @Max(12)
  @IsOptional()
  initialBillingMonth?: number;

  @IsInt()
  @IsOptional()
  initialBillingYear?: number;
}
