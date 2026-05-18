import {
  IsString,
  IsOptional,
  IsNumber,
  IsDateString,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateContractTerminationDto {
  @IsDateString()
  actualDepartureDate: string;

  @IsString()
  @IsOptional()
  apartmentCondition?: string;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  guaranteeDeduction: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  proratedRentAmount?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  servicesCost?: number;
}
