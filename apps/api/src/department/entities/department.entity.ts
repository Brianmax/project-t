import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { Property } from '../../property/entities/property.entity';

@Entity()
export class Department {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column()
  floor: number;

  @Column({ name: 'number_of_rooms' })
  numberOfRooms: number;

  @ManyToOne(() => Property, (property) => property.id)
  property: Property;

  @Column({ name: 'property_id' })
  propertyId: number;

  @Column({ default: true })
  isAvailable: boolean;
}
