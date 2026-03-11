import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { Contract } from '../../contract/entities/contract.entity';

@Entity()
export class ContractTermination {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'contract_id', type: 'uuid', unique: true })
  contractId: string;

  @ManyToOne(() => Contract, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'contract_id' })
  contract: Contract;

  @Column({ type: 'date', name: 'expected_departure_date' })
  expectedDepartureDate: Date;

  @Column({ type: 'date', name: 'actual_departure_date' })
  actualDepartureDate: Date;

  @Column({ type: 'text', nullable: true, name: 'apartment_condition' })
  apartmentCondition: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, name: 'advance_applied' })
  advanceApplied: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, name: 'guarantee_deposit' })
  guaranteeDeposit: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0, name: 'guarantee_deduction' })
  guaranteeDeduction: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, name: 'guarantee_return' })
  guaranteeReturn: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0, name: 'services_cost' })
  servicesCost: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0, name: 'rent_refund' })
  rentRefund: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
