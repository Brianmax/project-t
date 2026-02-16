import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import {
  DepartmentMeter,
  MeterType,
} from '../department-meter/entities/department-meter.entity';
import { MeterReading } from '../meter-reading/entities/meter-reading.entity';
import { Property } from '../property/entities/property.entity';

@Injectable()
export class ConsumptionService {
  private readonly COST_PER_UNIT_LIGHT = 0.25; // Example cost per unit for light
  private readonly COST_PER_UNIT_WATER = 0.15; // Example cost per unit for water

  constructor(
    @InjectRepository(DepartmentMeter)
    private readonly departmentMeterRepository: Repository<DepartmentMeter>,
    @InjectRepository(MeterReading)
    private readonly meterReadingRepository: Repository<MeterReading>,
    @InjectRepository(Property)
    private readonly propertyRepository: Repository<Property>,
  ) {}

  async calculateConsumptionForPeriod(
    departmentId: number,
    meterType: MeterType,
    startDate: Date,
    endDate: Date,
  ): Promise<{ consumption: number; cost: number }> {
    const departmentMeter = await this.departmentMeterRepository.findOne({
      where: { departmentId, meterType },
    });

    if (!departmentMeter) {
      return { consumption: 0, cost: 0 };
    }

    const readings = await this.meterReadingRepository.find({
      where: {
        departmentMeterId: departmentMeter.id,
        date: Between(startDate, endDate),
      },
      order: { date: 'ASC' },
    });

    if (readings.length < 2) {
      return { consumption: 0, cost: 0 }; // Need at least two readings to calculate consumption (start and end)
    }

    const firstReading = readings[0].reading;
    const lastReading = readings[readings.length - 1].reading;

    const consumption = lastReading - firstReading;
    let cost = 0;

    if (meterType === MeterType.LIGHT) {
      cost = consumption * this.COST_PER_UNIT_LIGHT;
    } else if (meterType === MeterType.WATER) {
      cost = consumption * this.COST_PER_UNIT_WATER;
    }

    return { consumption, cost };
  }

  async calculateCurrentConsumption(departmentId: number) {
    // Find the department to get its propertyId
    const deptMeter = await this.departmentMeterRepository.findOne({
      where: { departmentId },
      relations: ['department'],
    });

    // Get the property for rates — find from any meter's department, or query directly
    const department = deptMeter?.department;
    let property: Property | null = null;
    if (department) {
      property = await this.propertyRepository.findOne({
        where: { id: department.propertyId },
      });
    }

    const result: Record<
      string,
      {
        consumption: number;
        cost: number;
        lastReading: number | null;
        prevReading: number | null;
      }
    > = {};

    for (const meterType of [MeterType.LIGHT, MeterType.WATER]) {
      const meter = await this.departmentMeterRepository.findOne({
        where: { departmentId, meterType },
      });

      if (!meter) {
        result[meterType] = {
          consumption: 0,
          cost: 0,
          lastReading: null,
          prevReading: null,
        };
        continue;
      }

      const readings = await this.meterReadingRepository.find({
        where: { departmentMeterId: meter.id },
        order: { date: 'DESC' },
        take: 2,
      });

      if (readings.length < 2) {
        result[meterType] = {
          consumption: 0,
          cost: 0,
          lastReading: readings.length > 0 ? Number(readings[0].reading) : null,
          prevReading: null,
        };
        continue;
      }

      const consumption =
        Number(readings[0].reading) - Number(readings[1].reading);
      const rate =
        meterType === MeterType.LIGHT
          ? Number(property?.lightCostPerUnit ?? this.COST_PER_UNIT_LIGHT)
          : Number(property?.waterCostPerUnit ?? this.COST_PER_UNIT_WATER);
      const cost = consumption * rate;

      result[meterType] = {
        consumption,
        cost,
        lastReading: Number(readings[0].reading),
        prevReading: Number(readings[1].reading),
      };
    }

    return result;
  }
}
