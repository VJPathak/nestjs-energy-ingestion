import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1706700000000 implements MigrationInterface {
  name = 'InitialSchema1706700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Enable required extensions
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    // ============================================
    // HISTORICAL (COLD) TABLES - Append-only
    // ============================================

    // Meter telemetry history - partitioned by month
    await queryRunner.query(`
      CREATE TABLE meter_telemetry_history (
        id UUID DEFAULT uuid_generate_v4(),
        meter_id VARCHAR(50) NOT NULL,
        kwh_consumed_ac DECIMAL(12, 4) NOT NULL,
        voltage DECIMAL(8, 2) NOT NULL,
        timestamp TIMESTAMPTZ NOT NULL,
        ingested_at TIMESTAMPTZ DEFAULT NOW(),
        fleet_id VARCHAR(50),
        PRIMARY KEY (id, timestamp)
      ) PARTITION BY RANGE (timestamp)
    `);

    // Vehicle telemetry history - partitioned by month
    await queryRunner.query(`
      CREATE TABLE vehicle_telemetry_history (
        id UUID DEFAULT uuid_generate_v4(),
        vehicle_id VARCHAR(50) NOT NULL,
        soc DECIMAL(5, 2) NOT NULL,
        kwh_delivered_dc DECIMAL(12, 4) NOT NULL,
        battery_temp DECIMAL(5, 2) NOT NULL,
        timestamp TIMESTAMPTZ NOT NULL,
        ingested_at TIMESTAMPTZ DEFAULT NOW(),
        fleet_id VARCHAR(50),
        meter_id VARCHAR(50),
        PRIMARY KEY (id, timestamp)
      ) PARTITION BY RANGE (timestamp)
    `);

    // Create initial partitions (adjust dates as needed)
    const months = this.generateMonthPartitions();
    for (const { start, end, suffix } of months) {
      await queryRunner.query(`
        CREATE TABLE meter_telemetry_history_${suffix}
        PARTITION OF meter_telemetry_history
        FOR VALUES FROM ('${start}') TO ('${end}')
      `);

      await queryRunner.query(`
        CREATE TABLE vehicle_telemetry_history_${suffix}
        PARTITION OF vehicle_telemetry_history
        FOR VALUES FROM ('${start}') TO ('${end}')
      `);
    }

    // Indexes for historical tables (on partitions)
    await queryRunner.query(`
      CREATE INDEX idx_meter_history_meter_timestamp 
      ON meter_telemetry_history (meter_id, timestamp)
    `);

    await queryRunner.query(`
      CREATE INDEX idx_vehicle_history_vehicle_timestamp 
      ON vehicle_telemetry_history (vehicle_id, timestamp)
    `);

    await queryRunner.query(`
      CREATE INDEX idx_meter_history_timestamp 
      ON meter_telemetry_history (timestamp)
    `);

    await queryRunner.query(`
      CREATE INDEX idx_vehicle_history_timestamp 
      ON vehicle_telemetry_history (timestamp)
    `);

    // ============================================
    // LIVE (HOT) TABLES - UPSERT operations
    // ============================================

    // Meter live state - one row per meter
    await queryRunner.query(`
      CREATE TABLE meter_live_state (
        meter_id VARCHAR(50) PRIMARY KEY,
        kwh_consumed_ac DECIMAL(12, 4) NOT NULL,
        voltage DECIMAL(8, 2) NOT NULL,
        last_reported_at TIMESTAMPTZ NOT NULL,
        kwh_consumed_ac_today DECIMAL(12, 4) DEFAULT 0,
        status VARCHAR(20) DEFAULT 'online',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Vehicle live state - one row per vehicle
    await queryRunner.query(`
      CREATE TABLE vehicle_live_state (
        vehicle_id VARCHAR(50) PRIMARY KEY,
        soc DECIMAL(5, 2) NOT NULL,
        kwh_delivered_dc DECIMAL(12, 4) NOT NULL,
        battery_temp DECIMAL(5, 2) NOT NULL,
        last_reported_at TIMESTAMPTZ NOT NULL,
        kwh_delivered_dc_today DECIMAL(12, 4) DEFAULT 0,
        charging_status VARCHAR(20) DEFAULT 'idle',
        status VARCHAR(20) DEFAULT 'online',
        associated_meter_id VARCHAR(50),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Index for finding vehicles by meter
    await queryRunner.query(`
      CREATE INDEX idx_vehicle_live_meter 
      ON vehicle_live_state (associated_meter_id)
    `);

    // ============================================
    // FLEET ASSIGNMENTS - Junction table
    // ============================================

    await queryRunner.query(`
      CREATE TABLE fleet_assignments (
        id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
        fleet_id VARCHAR(50) NOT NULL,
        meter_id VARCHAR(50) NOT NULL,
        vehicle_id VARCHAR(50) NOT NULL,
        is_active BOOLEAN DEFAULT true,
        assigned_at TIMESTAMPTZ DEFAULT NOW(),
        unassigned_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(meter_id, vehicle_id)
      )
    `);

    await queryRunner.query(`
      CREATE INDEX idx_fleet_assignments_meter 
      ON fleet_assignments (meter_id) WHERE is_active = true
    `);

    await queryRunner.query(`
      CREATE INDEX idx_fleet_assignments_vehicle 
      ON fleet_assignments (vehicle_id) WHERE is_active = true
    `);

    await queryRunner.query(`
      CREATE INDEX idx_fleet_assignments_fleet 
      ON fleet_assignments (fleet_id)
    `);

    // ============================================
    // MATERIALIZED VIEW - Pre-aggregated analytics
    // ============================================

    await queryRunner.query(`
      CREATE MATERIALIZED VIEW daily_energy_summary AS
      SELECT
        DATE(vth.timestamp) as report_date,
        vth.vehicle_id,
        vth.meter_id,
        SUM(vth.kwh_delivered_dc) as total_dc_delivered,
        AVG(vth.battery_temp) as avg_battery_temp,
        MAX(vth.battery_temp) as max_battery_temp,
        MIN(vth.soc) as min_soc,
        MAX(vth.soc) as max_soc,
        COUNT(*) as reading_count
      FROM vehicle_telemetry_history vth
      WHERE vth.timestamp >= NOW() - INTERVAL '30 days'
      GROUP BY DATE(vth.timestamp), vth.vehicle_id, vth.meter_id
      WITH DATA
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX idx_daily_summary_pk 
      ON daily_energy_summary (report_date, vehicle_id)
    `);

    // Function to refresh materialized view
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION refresh_daily_summary()
      RETURNS void AS $$
      BEGIN
        REFRESH MATERIALIZED VIEW CONCURRENTLY daily_energy_summary;
      END;
      $$ LANGUAGE plpgsql
    `);

    // Auto-update trigger for live state tables
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION update_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);

    await queryRunner.query(`
      CREATE TRIGGER update_meter_live_state_updated_at
      BEFORE UPDATE ON meter_live_state
      FOR EACH ROW EXECUTE FUNCTION update_updated_at()
    `);

    await queryRunner.query(`
      CREATE TRIGGER update_vehicle_live_state_updated_at
      BEFORE UPDATE ON vehicle_live_state
      FOR EACH ROW EXECUTE FUNCTION update_updated_at()
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TRIGGER IF EXISTS update_vehicle_live_state_updated_at ON vehicle_live_state`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS update_meter_live_state_updated_at ON meter_live_state`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS update_updated_at()`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS refresh_daily_summary()`);
    await queryRunner.query(`DROP MATERIALIZED VIEW IF EXISTS daily_energy_summary`);
    await queryRunner.query(`DROP TABLE IF EXISTS fleet_assignments`);
    await queryRunner.query(`DROP TABLE IF EXISTS vehicle_live_state`);
    await queryRunner.query(`DROP TABLE IF EXISTS meter_live_state`);
    await queryRunner.query(`DROP TABLE IF EXISTS vehicle_telemetry_history`);
    await queryRunner.query(`DROP TABLE IF EXISTS meter_telemetry_history`);
  }

  private generateMonthPartitions(): Array<{ start: string; end: string; suffix: string }> {
    const partitions = [];
    const currentDate = new Date();
    
    // Create partitions for current month + 3 future months
    for (let i = -1; i <= 3; i++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() + i, 1);
      const nextMonth = new Date(date.getFullYear(), date.getMonth() + 1, 1);
      
      partitions.push({
        start: date.toISOString().split('T')[0],
        end: nextMonth.toISOString().split('T')[0],
        suffix: `${date.getFullYear()}_${String(date.getMonth() + 1).padStart(2, '0')}`,
      });
    }
    
    return partitions;
  }
}
