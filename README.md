# High-Scale Energy Ingestion Engine

## 🏗️ Architecture Overview

This enterprise-grade NestJS backend handles real-time telemetry ingestion from 10,000+ Smart Meters and EV Fleets, processing approximately **14.4 million records daily** (10,000 devices × 2 streams × 1440 minutes).

### Data Flow Architecture

```
┌─────────────────┐     ┌─────────────────┐
│   Smart Meter   │     │   EV Vehicle    │
│   (AC Side)     │     │   (DC Side)     │
└────────┬────────┘     └────────┬────────┘
         │                       │
         ▼                       ▼
┌─────────────────────────────────────────┐
│        Polymorphic Ingestion Layer      │
│   (Validation, Classification, DTOs)    │
└────────┬───────────────────────┬────────┘
         │                       │
         ▼                       ▼
┌─────────────────┐     ┌─────────────────┐
│   HOT STORE     │     │   COLD STORE    │
│   (Live State)  │     │   (Historical)  │
│   UPSERT Op     │     │   INSERT Op     │
└─────────────────┘     └─────────────────┘
         │                       │
         └───────────┬───────────┘
                     ▼
         ┌─────────────────────┐
         │  Analytics Engine   │
         │  (Materialized +    │
         │   Indexed Queries)  │
         └─────────────────────┘
```

## 🗄️ Database Strategy

### Hot vs Cold Data Separation

| Aspect | Hot Store (Operational) | Cold Store (Historical) |
|--------|------------------------|-------------------------|
| **Purpose** | Current device state | Audit trail & analytics |
| **Operation** | UPSERT (atomic update) | INSERT (append-only) |
| **Retention** | Latest state only | Indefinite (partitioned) |
| **Query Pattern** | Point lookups by ID | Range scans by time |
| **Optimization** | Primary key lookups | Time-based partitioning |

### Why This Approach?

1. **Dashboard Performance**: Live state tables have exactly N rows (one per device), enabling O(1) lookups instead of scanning millions of historical records.

2. **Write Optimization**: Historical tables use time-based partitioning (monthly), allowing efficient bulk operations and partition pruning.

3. **Analytical Efficiency**: Pre-aggregated materialized views avoid full table scans for common queries.

### Partitioning Strategy

```sql
-- Historical tables are partitioned by month
-- Each partition handles ~432M records/month
-- Queries with timestamp filters only scan relevant partitions
CREATE TABLE meter_telemetry_history (
    ...
) PARTITION BY RANGE (timestamp);

CREATE TABLE meter_telemetry_history_2025_01 
    PARTITION OF meter_telemetry_history
    FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
```

## 🔄 Data Correlation

### Meter-Vehicle Relationship

The system correlates AC consumption (meter) with DC delivery (vehicle) through a `fleet_assignments` junction table:

```
Smart Meter (meterId) ←→ Fleet Assignment ←→ Vehicle (vehicleId)
```

This enables:
- Calculating power efficiency (DC Delivered / AC Consumed)
- Detecting energy leakage when efficiency drops below threshold (85%)
- Attributing grid costs to specific vehicles

### Efficiency Calculation

```
Efficiency = (kwhDeliveredDc / kwhConsumedAc) × 100

Example:
- Meter reports: 100 kWh consumed (AC)
- Vehicle reports: 88 kWh delivered (DC)
- Efficiency: 88% ✓ (above 85% threshold)
```

## 📊 Handling 14.4M Daily Records

### Write Path Optimizations

1. **Batch Processing**: Incoming telemetry is buffered and batch-inserted every 5 seconds
2. **Connection Pooling**: PgBouncer manages connection reuse
3. **Prepared Statements**: Parameterized queries are cached
4. **Minimal Indexes on Write**: Historical tables have deferred indexing

### Read Path Optimizations

1. **Materialized Views**: Pre-computed hourly/daily aggregates
2. **Covering Indexes**: Include columns to avoid table lookups
3. **Partition Pruning**: Time-range queries scan only relevant partitions
4. **Live State Tables**: O(1) lookups for current status

## 🚀 Getting Started

### Prerequisites

- Docker & Docker Compose
- Node.js 18+ (for local development)
- PostgreSQL 15+ (via Docker)

### Quick Start

```bash
# Clone and enter directory
cd nestjs-energy-ingestion

# Start services
docker-compose up -d

# Run migrations
docker-compose exec app npm run migration:run

# The API is now available at http://localhost:3000
```

### Environment Variables

```env
DATABASE_URL=postgresql://postgres:postgres@db:5432/energy_db
NODE_ENV=production
PORT=3000
BATCH_SIZE=1000
BATCH_INTERVAL_MS=5000
```

## 📡 API Endpoints

### Telemetry Ingestion

```bash
# Ingest meter telemetry
POST /v1/telemetry/meter
{
  "meterId": "METER-001",
  "kwhConsumedAc": 150.5,
  "voltage": 240.2,
  "timestamp": "2025-01-31T10:00:00Z"
}

# Ingest vehicle telemetry
POST /v1/telemetry/vehicle
{
  "vehicleId": "VH-001",
  "soc": 75.5,
  "kwhDeliveredDc": 45.2,
  "batteryTemp": 32.5,
  "timestamp": "2025-01-31T10:00:00Z"
}

# Bulk ingestion (recommended for high throughput)
POST /v1/telemetry/bulk
{
  "meters": [...],
  "vehicles": [...]
}
```

### Analytics

```bash
# 24-hour vehicle performance summary
GET /v1/analytics/performance/:vehicleId

Response:
{
  "vehicleId": "VH-001",
  "period": {
    "start": "2025-01-30T10:00:00Z",
    "end": "2025-01-31T10:00:00Z"
  },
  "metrics": {
    "totalAcConsumed": 450.5,
    "totalDcDelivered": 392.2,
    "efficiencyRatio": 87.1,
    "avgBatteryTemp": 34.2,
    "peakBatteryTemp": 42.1,
    "chargingSessions": 8
  },
  "alerts": []
}
```

### Health & Monitoring

```bash
GET /health           # Service health
GET /health/db        # Database connectivity
GET /metrics          # Prometheus metrics
```

## 🧪 Testing

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Load testing (k6)
npm run test:load
```

## 📁 Project Structure

```
src/
├── config/                 # Configuration modules
│   ├── database.config.ts
│   └── app.config.ts
├── common/                 # Shared utilities
│   ├── decorators/
│   ├── filters/
│   ├── guards/
│   ├── interceptors/
│   └── pipes/
├── modules/
│   ├── telemetry/          # Ingestion module
│   │   ├── dto/
│   │   ├── entities/
│   │   ├── repositories/
│   │   ├── services/
│   │   └── controllers/
│   ├── analytics/          # Analytics module
│   │   ├── dto/
│   │   ├── services/
│   │   └── controllers/
│   └── health/             # Health checks
├── database/
│   ├── migrations/
│   └── seeds/
└── main.ts
```

## 🔧 Performance Tuning

### PostgreSQL Configuration

```sql
-- Recommended settings for write-heavy workload
shared_buffers = 4GB
effective_cache_size = 12GB
maintenance_work_mem = 1GB
checkpoint_completion_target = 0.9
wal_buffers = 64MB
default_statistics_target = 100
random_page_cost = 1.1
effective_io_concurrency = 200
work_mem = 16MB
min_wal_size = 1GB
max_wal_size = 4GB
max_worker_processes = 8
max_parallel_workers_per_gather = 4
max_parallel_workers = 8
max_parallel_maintenance_workers = 4
```

## 📈 Monitoring

The system exposes Prometheus metrics:

- `telemetry_ingestion_total` - Total records ingested
- `telemetry_ingestion_latency_ms` - Ingestion latency histogram
- `telemetry_batch_size` - Batch sizes processed
- `analytics_query_duration_ms` - Analytics query performance
- `db_connection_pool_size` - Active database connections

## License

MIT
