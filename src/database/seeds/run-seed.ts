import { DataSource } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

const dataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/energy_db',
  synchronize: false,
});

async function seed() {
  await dataSource.initialize();
  console.log('Database connected');

  const queryRunner = dataSource.createQueryRunner();

  try {
    // Create sample fleet assignments
    const fleets = [
      { fleetId: 'FLEET-001', name: 'Downtown Depot' },
      { fleetId: 'FLEET-002', name: 'Airport Hub' },
    ];

    const assignments = [];

    // Create 100 sample assignments (10 meters, 10 vehicles each)
    for (let m = 1; m <= 10; m++) {
      for (let v = 1; v <= 10; v++) {
        assignments.push({
          id: uuidv4(),
          fleetId: fleets[m % 2].fleetId,
          meterId: `METER-${String(m).padStart(3, '0')}`,
          vehicleId: `VH-${String(m).padStart(3, '0')}-${String(v).padStart(2, '0')}`,
          isActive: true,
          assignedAt: new Date(),
        });
      }
    }

    // Insert fleet assignments
    for (const assignment of assignments) {
      await queryRunner.query(
        `
        INSERT INTO fleet_assignments (id, fleet_id, meter_id, vehicle_id, is_active, assigned_at)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (meter_id, vehicle_id) DO NOTHING
      `,
        [
          assignment.id,
          assignment.fleetId,
          assignment.meterId,
          assignment.vehicleId,
          assignment.isActive,
          assignment.assignedAt,
        ],
      );
    }

    console.log(`Created ${assignments.length} fleet assignments`);

    // Create sample live states for meters
    for (let m = 1; m <= 10; m++) {
      const meterId = `METER-${String(m).padStart(3, '0')}`;
      await queryRunner.query(
        `
        INSERT INTO meter_live_state (meter_id, kwh_consumed_ac, voltage, last_reported_at, status)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (meter_id) DO UPDATE SET
          kwh_consumed_ac = EXCLUDED.kwh_consumed_ac,
          voltage = EXCLUDED.voltage,
          last_reported_at = EXCLUDED.last_reported_at
      `,
        [meterId, 100 + Math.random() * 500, 230 + Math.random() * 20, new Date(), 'online'],
      );
    }

    console.log('Created sample meter live states');

    // Create sample live states for vehicles
    for (const assignment of assignments.slice(0, 20)) {
      await queryRunner.query(
        `
        INSERT INTO vehicle_live_state 
          (vehicle_id, soc, kwh_delivered_dc, battery_temp, last_reported_at, charging_status, status, associated_meter_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (vehicle_id) DO UPDATE SET
          soc = EXCLUDED.soc,
          kwh_delivered_dc = EXCLUDED.kwh_delivered_dc,
          battery_temp = EXCLUDED.battery_temp,
          last_reported_at = EXCLUDED.last_reported_at
      `,
        [
          assignment.vehicleId,
          50 + Math.random() * 50,
          80 + Math.random() * 400,
          25 + Math.random() * 20,
          new Date(),
          Math.random() > 0.5 ? 'charging' : 'idle',
          'online',
          assignment.meterId,
        ],
      );
    }

    console.log('Created sample vehicle live states');

    // Generate some historical data for the past 24 hours
    const now = new Date();
    const historicalRecords = [];

    for (let hour = 0; hour < 24; hour++) {
      const timestamp = new Date(now.getTime() - hour * 60 * 60 * 1000);

      for (const assignment of assignments.slice(0, 10)) {
        // Meter history
        await queryRunner.query(
          `
          INSERT INTO meter_telemetry_history (meter_id, kwh_consumed_ac, voltage, timestamp, fleet_id)
          VALUES ($1, $2, $3, $4, $5)
        `,
          [
            assignment.meterId,
            10 + Math.random() * 20,
            230 + Math.random() * 20,
            timestamp,
            assignment.fleetId,
          ],
        );

        // Vehicle history
        await queryRunner.query(
          `
          INSERT INTO vehicle_telemetry_history 
            (vehicle_id, soc, kwh_delivered_dc, battery_temp, timestamp, fleet_id, meter_id)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `,
          [
            assignment.vehicleId,
            50 + Math.random() * 50,
            8 + Math.random() * 17, // ~85-90% efficiency
            25 + Math.random() * 20,
            timestamp,
            assignment.fleetId,
            assignment.meterId,
          ],
        );
      }
    }

    console.log('Created 24 hours of historical data');

    // Refresh materialized view
    await queryRunner.query('REFRESH MATERIALIZED VIEW daily_energy_summary');
    console.log('Refreshed materialized view');

    console.log('Seeding complete!');
  } catch (error) {
    console.error('Seeding failed:', error);
    throw error;
  } finally {
    await queryRunner.release();
    await dataSource.destroy();
  }
}

seed().catch(console.error);
