import { Controller, Get, Param } from '@nestjs/common';
import { ConsumptionService } from './consumption.service';

@Controller('departments')
export class ConsumptionController {
  constructor(private readonly consumptionService: ConsumptionService) {}

  @Get(':id/consumption')
  calculateCurrentConsumption(
    @Param('id') departmentId: string,
  ) {
    return this.consumptionService.calculateCurrentConsumption(departmentId);
  }
}
