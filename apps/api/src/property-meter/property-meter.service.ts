import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PropertyMeter } from './entities/property-meter.entity';
import { CreatePropertyMeterDto } from './dto/create-property-meter.dto';
import { UpdatePropertyMeterDto } from './dto/update-property-meter.dto';
import { Property } from '../property/entities/property.entity';

@Injectable()
export class PropertyMeterService {
  constructor(
    @InjectRepository(PropertyMeter)
    private readonly propertyMeterRepository: Repository<PropertyMeter>,
    @InjectRepository(Property)
    private readonly propertyRepository: Repository<Property>,
  ) {}

  async create(
    createPropertyMeterDto: CreatePropertyMeterDto,
  ): Promise<PropertyMeter> {
    const property = await this.propertyRepository.findOne({
      where: { id: createPropertyMeterDto.propertyId },
    });
    if (!property) {
      throw new BadRequestException(
        `Property with ID "${createPropertyMeterDto.propertyId}" not found`,
      );
    }

    const propertyMeter = this.propertyMeterRepository.create({
      ...createPropertyMeterDto,
      property: property,
    });
    return this.propertyMeterRepository.save(propertyMeter);
  }

  async findAll(): Promise<PropertyMeter[]> {
    return this.propertyMeterRepository.find({ relations: ['property'] });
  }

  async findOne(id: number): Promise<PropertyMeter> {
    const propertyMeter = await this.propertyMeterRepository.findOne({
      where: { id },
      relations: ['property'],
    });
    if (!propertyMeter) {
      throw new NotFoundException(`PropertyMeter with ID "${id}" not found`);
    }
    return propertyMeter;
  }

  async update(
    id: number,
    updatePropertyMeterDto: UpdatePropertyMeterDto,
  ): Promise<PropertyMeter> {
    const propertyMeter = await this.findOne(id);

    if (updatePropertyMeterDto.propertyId) {
      const property = await this.propertyRepository.findOne({
        where: { id: updatePropertyMeterDto.propertyId },
      });
      if (!property) {
        throw new BadRequestException(
          `Property with ID "${updatePropertyMeterDto.propertyId}" not found`,
        );
      }
      propertyMeter.property = property;
    }

    this.propertyMeterRepository.merge(propertyMeter, updatePropertyMeterDto);
    return this.propertyMeterRepository.save(propertyMeter);
  }

  async remove(id: number): Promise<void> {
    const propertyMeter = await this.findOne(id);
    await this.propertyMeterRepository.remove(propertyMeter);
  }
}
