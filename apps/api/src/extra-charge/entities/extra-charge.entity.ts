import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { Contract } from '../../contract/entities/contract.entity';

@Entity()
export class ExtraCharge {
  @PrimaryGeneratedColumn()
  id: number;

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

  @Column({ name: 'contract_id' })
  contractId: number;
}
