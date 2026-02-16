import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Department } from '../../department/entities/department.entity';

export enum MeterType {
  LIGHT = 'light',
  WATER = 'water',
}

@Entity()
export class DepartmentMeter {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'enum', enum: MeterType })
  meterType: MeterType;

  @ManyToOne(() => Department, (department) => department.id, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'department_id' })
  department: Department;

  @Column({ name: 'department_id' })
  departmentId: number;
}
