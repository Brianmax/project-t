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
    @Query('startDay', new ParseIntPipe({ optional: true }))
    startDay?: number,
    @Query('endDay', new ParseIntPipe({ optional: true }))
    endDay?: number,
  ) {
    return Promise.all([
      this.consumptionService.calculateConsumptionForPeriod(
        departmentId,
        MeterType.LIGHT,
        month,
        year,
        startDay,
        endDay,
      ),
      this.consumptionService.calculateConsumptionForPeriod(
        departmentId,
        MeterType.WATER,
        month,
        year,
        startDay,
        endDay,
      ),
      this.consumptionService.findMetersMissingReadingsForPeriod(
        departmentId,
        month,
        year,
        endDay,
      ),
    ]).then(([light, water, missingMeterTypes]) => ({
      light: {
        consumption: light.consumption,
        cost: light.cost,
        currentReading: light.currentReading,
        previousReading: light.previousReading,
      },
      water: {
        consumption: water.consumption,
        cost: water.cost,
        currentReading: water.currentReading,
        previousReading: water.previousReading,
      },
      missingMeterTypes,
    }));
  }
}
