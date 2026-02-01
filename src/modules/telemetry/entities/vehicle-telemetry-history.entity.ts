import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  Index,
  CreateDateColumn,
} from 'typeorm';

/**
 * Historical (Cold) store for vehicle telemetry
 * Append-only INSERT operations for audit trail
 * Partitioned by timestamp for efficient range queries
 */
@Entity('vehicle_telemetry_history')
@Index(['vehicleId', 'timestamp']) // Composite index for vehicle-specific time queries
@Index(['timestamp']) // For partition pruning
export class VehicleTelemetryHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50 })
  @Index()
  vehicleId: string;

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  soc: number; // State of Charge (0-100%)

  @Column({ type: 'decimal', precision: 12, scale: 4 })
  kwhDeliveredDc: number;

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  batteryTemp: number;

  @Column({ type: 'timestamptz' })
  timestamp: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  ingestedAt: Date;

  // Denormalized for faster analytics
  @Column({ type: 'varchar', length: 50, nullable: true })
  fleetId: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  meterId: string; // Associated meter for efficiency calculation
}
