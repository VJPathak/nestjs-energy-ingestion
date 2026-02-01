import {
  Entity,
  Column,
  PrimaryColumn,
  UpdateDateColumn,
  CreateDateColumn,
} from 'typeorm';

/**
 * Live (Hot) store for meter current state
 * UPSERT operations for fast dashboard queries
 * One row per meter (exactly N rows for N meters)
 */
@Entity('meter_live_state')
export class MeterLiveState {
  @PrimaryColumn({ type: 'varchar', length: 50 })
  meterId: string;

  @Column({ type: 'decimal', precision: 12, scale: 4 })
  kwhConsumedAc: number;

  @Column({ type: 'decimal', precision: 8, scale: 2 })
  voltage: number;

  @Column({ type: 'timestamptz' })
  lastReportedAt: Date;

  @Column({ type: 'decimal', precision: 12, scale: 4, default: 0 })
  kwhConsumedAcToday: number; // Running total for current day

  @Column({ type: 'varchar', length: 20, default: 'online' })
  status: 'online' | 'offline' | 'warning' | 'error';

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
