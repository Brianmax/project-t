import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { Tenant } from '../../tenant/entities/tenant.entity';
import { Department } from '../../department/entities/department.entity';

@Entity()
export class Contract {
  @PrimaryGeneratedColumn()
  id: number;

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

  @Column({ name: 'tenant_id' })
  tenantId: number; // Foreign key for Tenant

  @ManyToOne(() => Department, (department) => department.id)
  department: Department;

  @Column({ name: 'department_id' })
  departmentId: number; // Foreign key for Department
}
