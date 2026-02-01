import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  Index,
  CreateDateColumn,
} from 'typeorm';

/**
 * Historical (Cold) store for meter telemetry
 * Append-only INSERT operations for audit trail
 * Partitioned by timestamp for efficient range queries
 */
@Entity('meter_telemetry_history')
@Index(['meterId', 'timestamp']) // Composite index for vehicle-specific time queries
@Index(['timestamp']) // For partition pruning
export class MeterTelemetryHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50 })
  @Index()
  meterId: string;

  @Column({ type: 'decimal', precision: 12, scale: 4 })
  kwhConsumedAc: number;

  @Column({ type: 'decimal', precision: 8, scale: 2 })
  voltage: number;

  @Column({ type: 'timestamptz' })
  timestamp: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  ingestedAt: Date;

  // Denormalized for faster analytics (avoids joins)
  @Column({ type: 'varchar', length: 50, nullable: true })
  fleetId: string;
}
