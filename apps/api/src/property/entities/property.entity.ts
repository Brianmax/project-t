import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity()
export class Property {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column()
  address: string;

  @Column({
    name: 'light_cost_per_unit',
    type: 'decimal',
    precision: 10,
    scale: 4,
    default: 0.25,
  })
  lightCostPerUnit: number;

  @Column({
    name: 'water_cost_per_unit',
    type: 'decimal',
    precision: 10,
    scale: 4,
    default: 0.15,
  })
  waterCostPerUnit: number;
}
