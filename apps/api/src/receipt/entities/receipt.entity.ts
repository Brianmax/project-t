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
  UNPAID = 'unpaid',
  PAID = 'paid',
}

export type PdfStatus = 'idle' | 'queued' | 'rendering' | 'ready' | 'failed';

@Entity()
@Unique('uq_receipt_contract_period', ['contractId', 'month', 'year'])
export class ReceiptEntity {
  // `status`, `paidAt`, `paidBy`, `totalPayments`, `balance` are written only
  // by ContractLedgerService.recalculate(). Do not write them from anywhere else.

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

  @Column({ type: 'int', nullable: true, default: null })
  startDay: number | null;

  @Column({ type: 'int', nullable: true, default: null })
  endDay: number | null;

  @Column({ type: 'varchar', length: 64 })
  tenantName: string;

  @Column({
    name: 'tenant_document_id',
    type: 'varchar',
    length: 32,
    nullable: true,
  })
  tenantDocumentId: string | null;

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

  @Column({ type: 'jsonb', nullable: true })
  carryForwardDetails: Array<{ period: string; balance: number }> | null;

  @Column({
    type: 'enum',
    enum: ReceiptStatus,
    default: ReceiptStatus.UNPAID,
  })
  status: ReceiptStatus;

  @Column({ name: 'paid_at', type: 'timestamptz', nullable: true })
  paidAt: Date | null;

  @Column({ name: 'paid_by', type: 'uuid', nullable: true })
  paidBy: string | null;

  @Column({ name: 'pdf_key', type: 'varchar', length: 512, nullable: true })
  pdfKey: string | null;

  @Column({ name: 'pdf_generated_at', type: 'timestamptz', nullable: true })
  pdfGeneratedAt: Date | null;

  @Column({
    name: 'pdf_content_type',
    type: 'varchar',
    length: 64,
    nullable: true,
  })
  pdfContentType: string | null;

  @Column({
    name: 'pdf_status',
    type: 'varchar',
    length: 16,
    nullable: false,
    default: 'idle',
  })
  pdfStatus: PdfStatus;

  @Column({ name: 'pdf_error', type: 'text', nullable: true })
  pdfError: string | null;

  @Column({ name: 'pdf_job_id', type: 'varchar', length: 64, nullable: true })
  pdfJobId: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
