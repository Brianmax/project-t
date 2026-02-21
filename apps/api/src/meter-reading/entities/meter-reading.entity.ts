import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { DepartmentMeter } from '../../department-meter/entities/department-meter.entity';

@Entity()
export class MeterReading {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  reading: number;

  @Column({ type: 'date' })
  date: Date;

  @ManyToOne(() => DepartmentMeter, (departmentMeter) => departmentMeter.id, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'department_meter_id' })
  departmentMeter: DepartmentMeter;

  @Column({ name: 'department_meter_id', type: 'uuid' })
  departmentMeterId: string;
}
