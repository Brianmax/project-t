import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Contract } from '../../contract/entities/contract.entity';
import { ReceiptEntity } from '../../receipt/entities/receipt.entity';

export enum ExtraChargeType {
  MANUAL = 'manual',
  LATE_FEE = 'late_fee',
}

@Entity()
export class ExtraCharge {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  description: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column()
  month: number;

  @Column()
  year: number;

  @ManyToOne(() => Contract, (contract) => contract.id)
  contract: Contract;

  @Column({ name: 'contract_id', type: 'uuid' })
  contractId: string;

  @Column({
    type: 'enum',
    enum: ExtraChargeType,
    default: ExtraChargeType.MANUAL,
  })
  type: ExtraChargeType;

  @Column({
    name: 'source_receipt_id',
    type: 'uuid',
    nullable: true,
    default: null,
  })
  sourceReceiptId: string | null;

  @ManyToOne(() => ReceiptEntity, { nullable: true })
  @JoinColumn({ name: 'source_receipt_id' })
  sourceReceipt: ReceiptEntity | null;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
    default: null,
  })
  ratePerDay: number | null;

  @Column({ type: 'int', nullable: true, default: null })
  daysOverdue: number | null;
}
