import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { Contract } from '../../contract/entities/contract.entity';
import { ReceiptEntity } from '../../receipt/entities/receipt.entity';

export enum PaymentMethod {
  CASH = 'cash',
  BANK_TRANSFER = 'bank_transfer',
  YAPE = 'yape',
  PLIN = 'plin',
  OTHER = 'other',
}

@Entity()
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({ type: 'date' })
  date: Date;

  @Column({ nullable: true })
  description: string;

  @Column({
    type: 'enum',
    enum: PaymentMethod,
    default: PaymentMethod.CASH,
  })
  method: PaymentMethod;

  @Column({ type: 'varchar', length: 128, nullable: true })
  reference: string | null;

  @ManyToOne(() => Contract, (contract) => contract.id, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'contract_id' })
  contract: Contract;

  @Index()
  @Column({ name: 'contract_id', type: 'uuid' })
  contractId: string;

  @ManyToOne(() => ReceiptEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'receipt_id' })
  receipt: ReceiptEntity | null;

  @Index()
  @Column({ name: 'receipt_id', type: 'uuid', nullable: true })
  receiptId: string | null;

  @Column({ name: 'recorded_by', type: 'uuid', nullable: true })
  recordedBy: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
