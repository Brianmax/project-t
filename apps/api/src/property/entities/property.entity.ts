import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity()
export class Property {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column()
  address: string;

  @Column({
    name: 'light_cost_per_unit',
    type: 'decimal',
    precision: 10,
    scale: 4,
    default: 0.25,
  })
  lightCostPerUnit: number;

  @Column({
    name: 'water_cost_per_unit',
    type: 'decimal',
    precision: 10,
    scale: 4,
    default: 0.15,
  })
  waterCostPerUnit: number;

  @Column({
    name: 'seal_supply_code',
    type: 'varchar',
    length: 20,
    nullable: true,
    unique: true,
  })
  sealSupplyCode: string | null;

  @Column({
    name: 'seal_branch_code',
    type: 'varchar',
    length: 5,
    nullable: true,
    default: '1',
  })
  sealBranchCode: string | null;

  @Column({
    name: 'seal_last_synced_at',
    type: 'timestamptz',
    nullable: true,
  })
  sealLastSyncedAt: Date | null;

  @Column({
    name: 'seal_last_sync_error',
    type: 'text',
    nullable: true,
  })
  sealLastSyncError: string | null;
}
