import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { ConsumptionService } from './consumption.service';

@Controller('consumption')
export class ConsumptionController {
  constructor(private readonly consumptionService: ConsumptionService) {}

  @Get('department/:departmentId')
  calculateCurrentConsumption(
    @Param('departmentId', ParseIntPipe) departmentId: number,
  ) {
    return this.consumptionService.calculateCurrentConsumption(departmentId);
  }
}
