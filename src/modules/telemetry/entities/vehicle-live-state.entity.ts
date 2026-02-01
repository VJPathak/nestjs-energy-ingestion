import {
  Entity,
  Column,
  PrimaryColumn,
  UpdateDateColumn,
  CreateDateColumn,
} from 'typeorm';

/**
 * Live (Hot) store for vehicle current state
 * UPSERT operations for fast dashboard queries
 * One row per vehicle (exactly N rows for N vehicles)
 */
@Entity('vehicle_live_state')
export class VehicleLiveState {
  @PrimaryColumn({ type: 'varchar', length: 50 })
  vehicleId: string;

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  soc: number;

  @Column({ type: 'decimal', precision: 12, scale: 4 })
  kwhDeliveredDc: number;

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  batteryTemp: number;

  @Column({ type: 'timestamptz' })
  lastReportedAt: Date;

  @Column({ type: 'decimal', precision: 12, scale: 4, default: 0 })
  kwhDeliveredDcToday: number; // Running total for current day

  @Column({ type: 'varchar', length: 20, default: 'idle' })
  chargingStatus: 'charging' | 'idle' | 'discharging' | 'error';

  @Column({ type: 'varchar', length: 20, default: 'online' })
  status: 'online' | 'offline' | 'warning' | 'error';

  @Column({ type: 'varchar', length: 50, nullable: true })
  associatedMeterId: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
