import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Contract } from '../../contract/entities/contract.entity';

export enum PaymentType {
  RENT = 'rent',
  WATER = 'water',
  LIGHT = 'light',
  ADVANCE = 'advance',
  GUARANTEE = 'guarantee',
  REFUND = 'refund',
}

@Entity()
export class Payment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({ type: 'date' })
  date: Date;

  @Column({ nullable: true })
  description: string;

  @Column({ type: 'enum', enum: PaymentType })
  type: PaymentType;

  @ManyToOne(() => Contract, (contract) => contract.id, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'contract_id' })
  contract: Contract;

  @Column({ name: 'contract_id' })
  contractId: number;
}
