import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { Contract } from '../../contract/entities/contract.entity';

export enum ReceiptStatus {
  PENDING_REVIEW = 'pending_review',
  APPROVED = 'approved',
  DENIED = 'denied',
}

@Entity()
@Unique('uq_receipt_contract_period', ['contractId', 'month', 'year'])
export class ReceiptEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Contract, (contract) => contract.id, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'contract_id' })
  contract: Contract;

  @Column({ name: 'contract_id', type: 'uuid' })
  contractId: string;

  @Column({ type: 'int' })
  month: number;

  @Column({ type: 'int' })
  year: number;

  @Column({ type: 'varchar', length: 64 })
  tenantName: string;

  @Column({ type: 'varchar', length: 64 })
  departmentName: string;

  @Column({ type: 'varchar', length: 255 })
  propertyAddress: string;

  @Column({ type: 'varchar', length: 64 })
  period: string;

  @Column({ type: 'jsonb' })
  items: Array<{ description: string; amount: number }>;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  totalPayments: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  totalDue: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  balance: number;

  @Column({
    type: 'enum',
    enum: ReceiptStatus,
    default: ReceiptStatus.PENDING_REVIEW,
  })
  status: ReceiptStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
