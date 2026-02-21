import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreatePropertyDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  address: string;

  @IsNumber()
  @IsOptional()
  lightCostPerUnit?: number;

  @IsNumber()
  @IsOptional()
  waterCostPerUnit?: number;
}
