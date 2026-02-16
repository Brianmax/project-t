import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Property } from '../../property/entities/property.entity';
import { MeterType } from '../../department-meter/entities/department-meter.entity'; // Reusing MeterType enum

@Entity()
export class PropertyMeter {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'enum', enum: MeterType })
  meterType: MeterType;

  @ManyToOne(() => Property, (property) => property.id, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'property_id' })
  property: Property;

  @Column({ name: 'property_id' })
  propertyId: number;
}
