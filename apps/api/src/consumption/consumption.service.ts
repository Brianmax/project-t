import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  DepartmentMeter,
  MeterType,
} from '../department-meter/entities/department-meter.entity';
import { MeterReading } from '../meter-reading/entities/meter-reading.entity';
import { Property } from '../property/entities/property.entity';

@Injectable()
export class ConsumptionService {
  private readonly logger = new Logger(ConsumptionService.name);
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
    departmentId: string,
    meterType: MeterType,
    month: number,
    year: number,
    startDay?: number,
    endDay?: number,
  ): Promise<{ consumption: number; cost: number }> {
    const departmentMeter = await this.departmentMeterRepository.findOne({
      where: { departmentId, meterType },
      relations: ['department'],
    });

    if (!departmentMeter) {
      return { consumption: 0, cost: 0 };
    }

    const property = departmentMeter.department?.propertyId
      ? await this.propertyRepository.findOne({
          where: { id: departmentMeter.department.propertyId },
        })
      : null;

    let currentReading: MeterReading | null;
    let previousReading: MeterReading | null;

    if (startDay !== undefined && endDay !== undefined) {
      const rangeStart = new Date(year, month - 1, startDay);
      const rangeEnd = new Date(year, month - 1, endDay);

      currentReading = await this.meterReadingRepository
        .createQueryBuilder('mr')
        .where('mr.departmentMeterId = :meterId', {
          meterId: departmentMeter.id,
        })
        .andWhere('mr.date <= :rangeEnd', { rangeEnd })
        .orderBy('mr.date', 'DESC')
        .getOne();

      if (!currentReading) {
        return { consumption: 0, cost: 0 };
      }

      previousReading = await this.meterReadingRepository
        .createQueryBuilder('mr')
        .where('mr.departmentMeterId = :meterId', {
          meterId: departmentMeter.id,
        })
        .andWhere('mr.date < :rangeStart', { rangeStart })
        .orderBy('mr.date', 'DESC')
        .getOne();
    } else {
      currentReading = await this.meterReadingRepository.findOne({
        where: {
          departmentMeterId: departmentMeter.id,
          billingMonth: month,
          billingYear: year,
        },
        order: { date: 'DESC' },
      });

      if (!currentReading) {
        return { consumption: 0, cost: 0 };
      }

      previousReading = await this.meterReadingRepository
        .createQueryBuilder('mr')
        .where('mr.departmentMeterId = :meterId', {
          meterId: departmentMeter.id,
        })
        .andWhere(
          '(mr.billingYear < :year OR (mr.billingYear = :year AND mr.billingMonth < :month))',
          { year, month },
        )
        .orderBy('mr.billingYear', 'DESC')
        .addOrderBy('mr.billingMonth', 'DESC')
        .addOrderBy('mr.date', 'DESC')
        .getOne();
    }

    if (!previousReading) {
      return { consumption: 0, cost: 0 };
    }

    const consumption =
      Number(currentReading.reading) - Number(previousReading.reading);

    if (consumption < 0) {
      this.logger.warn(
        `Negative consumption detected for meter ${departmentMeter.id}: ` +
          `current=${currentReading.reading} previous=${previousReading.reading} consumption=${consumption}`,
      );
      return { consumption: 0, cost: 0 };
    }
    let cost = 0;

    if (meterType === MeterType.LIGHT) {
      const rate = Number(
        property?.lightCostPerUnit ?? this.COST_PER_UNIT_LIGHT,
      );
      cost = consumption * rate;
    } else if (meterType === MeterType.WATER) {
      const rate = Number(
        property?.waterCostPerUnit ?? this.COST_PER_UNIT_WATER,
      );
      cost = consumption * rate;
    }

    return { consumption, cost };
  }

  async calculateCurrentConsumption(departmentId: string) {
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

      if (consumption < 0) {
        this.logger.warn(
          `Negative consumption detected for meter ${meter.id}: ` +
            `current=${readings[0].reading} previous=${readings[1].reading} consumption=${consumption}`,
        );
        result[meterType] = {
          consumption: 0,
          cost: 0,
          lastReading: Number(readings[0].reading),
          prevReading: Number(readings[1].reading),
        };
        continue;
      }
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
