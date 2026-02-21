import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { Tenant } from '../../tenant/entities/tenant.entity';
import { Department } from '../../department/entities/department.entity';

@Entity()
export class Contract {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'date' })
  startDate: Date;

  @Column({ type: 'date' })
  endDate: Date;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  rentAmount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  advancePayment: number; // Represents one month's rent upfront

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  guaranteeDeposit: number; // Security deposit

  @ManyToOne(() => Tenant, (tenant) => tenant.id)
  tenant: Tenant;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string; // Foreign key for Tenant

  @ManyToOne(() => Department, (department) => department.id)
  department: Department;

  @Column({ name: 'department_id', type: 'uuid' })
  departmentId: string; // Foreign key for Department
}
