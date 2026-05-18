import { Controller, Get, Param, Query, ParseIntPipe } from '@nestjs/common';
import { ConsumptionService } from './consumption.service';
import { MeterType } from '../department-meter/entities/department-meter.entity';
import { MeterReadingService } from '../meter-reading/meter-reading.service';

@Controller('departments')
export class ConsumptionController {
  constructor(
    private readonly consumptionService: ConsumptionService,
    private readonly meterReadingService: MeterReadingService,
  ) {}

  @Get(':id/meter-readings/latest')
  findLatestReadingDate(@Param('id') departmentId: string) {
    return this.meterReadingService.findLatestDateByDepartment(departmentId);
  }

  @Get(':id/meter-readings/earliest-billing-period')
  findEarliestBillingPeriod(@Param('id') departmentId: string) {
    return this.meterReadingService.findEarliestBillingPeriodByDepartment(
      departmentId,
    );
  }

  @Get(':id/consumption')
  calculateCurrentConsumption(@Param('id') departmentId: string) {
    return this.consumptionService.calculateCurrentConsumption(departmentId);
  }

  @Get(':id/consumption/period')
  calculateConsumptionForPeriod(
    @Param('id') departmentId: string,
    @Query('month', ParseIntPipe) month: number,
    @Query('year', ParseIntPipe) year: number,
  ) {
    return Promise.all([
      this.consumptionService.calculateConsumptionForPeriod(
        departmentId,
        MeterType.LIGHT,
        month,
        year,
      ),
      this.consumptionService.calculateConsumptionForPeriod(
        departmentId,
        MeterType.WATER,
        month,
        year,
      ),
    ]).then(([light, water]) => ({
      light: { consumption: light.consumption, cost: light.cost },
      water: { consumption: water.consumption, cost: water.cost },
    }));
  }
}
