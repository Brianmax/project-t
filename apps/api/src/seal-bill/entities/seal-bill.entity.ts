import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Unique,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Property } from '../../property/entities/property.entity';
import { SealBillStatus } from './seal-bill-status';

@Entity('seal_bill')
@Unique(['propertyId', 'periodoComercial'])
export class SealBill {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Property, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'property_id' })
  property: Property;

  @Column({ name: 'property_id', type: 'uuid' })
  propertyId: string;

  @Column({ name: 'periodo_comercial', type: 'char', length: 6 })
  periodoComercial: string;

  @Column({
    name: 'comprobante_code',
    type: 'char',
    length: 19,
    unique: true,
  })
  comprobanteCode: string;

  @Column({ name: 'due_date', type: 'date' })
  dueDate: string;

  @Column({ name: 'payment_date', type: 'date', nullable: true })
  paymentDate: string | null;

  @Column({ type: 'enum', enum: SealBillStatus })
  status: SealBillStatus;

  @Column({ name: 'amount_pen', type: 'decimal', precision: 10, scale: 4 })
  amountPen: string;

  @Column({ type: 'int' })
  kwh: number;

  @Column({
    name: 'pdf_storage_key',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  pdfStorageKey: string | null;

  @Column({
    name: 'pdf_fetched_at',
    type: 'timestamptz',
    nullable: true,
  })
  pdfFetchedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
