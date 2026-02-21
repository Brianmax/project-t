import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { Property } from '../../property/entities/property.entity';

@Entity()
export class Department {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column()
  floor: number;

  @Column({ name: 'number_of_rooms' })
  numberOfRooms: number;

  @ManyToOne(() => Property, (property) => property.id)
  property: Property;

  @Column({ name: 'property_id', type: 'uuid' })
  propertyId: string;

  @Column({ default: true })
  isAvailable: boolean;
}
