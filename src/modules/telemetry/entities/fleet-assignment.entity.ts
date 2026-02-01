import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Junction table correlating meters with vehicles
 * Enables efficiency calculations across AC/DC boundaries
 */
@Entity('fleet_assignments')
@Index(['meterId', 'vehicleId'], { unique: true })
export class FleetAssignment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50 })
  @Index()
  fleetId: string;

  @Column({ type: 'varchar', length: 50 })
  @Index()
  meterId: string;

  @Column({ type: 'varchar', length: 50 })
  @Index()
  vehicleId: string;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  assignedAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  unassignedAt: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
