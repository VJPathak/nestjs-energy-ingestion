# API Quick Start Guide

## 🚀 Running the API

### Option 1: Docker (Recommended)
```bash
cd nestjs-energy-ingestion

# Start all services (API, PostgreSQL, PgBouncer, Prometheus, Grafana)
docker-compose up -d

# Check logs
docker-compose logs -f app
```

**Services will be available at:**
| Service | URL |
|---------|-----|
| API | http://localhost:3000 |
| Swagger Docs | http://localhost:3000/api/docs |
| Prometheus | http://localhost:9090 |
| Grafana | http://localhost:3001 (admin/admin) |
| PostgreSQL | localhost:5432 |
| PgBouncer | localhost:6432 |

### Option 2: Local Development
```bash
cd nestjs-energy-ingestion

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Start PostgreSQL (required)
docker run -d --name energy-postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=energy_db \
  -p 5432:5432 \
  postgres:15-alpine

# Run migrations
npm run migration:run

# Start in dev mode
npm run start:dev
```

---

## 📡 API Endpoints

### Base URL
```
http://localhost:3000/v1
```

### Health Check
```bash
GET /health
```

### Telemetry Ingestion

#### Single Meter Reading
```bash
POST /v1/telemetry/meter
Content-Type: application/json

{
  "meterId": "METER-001",
  "kwhConsumedAc": 150.5,
  "voltage": 240.2,
  "timestamp": "2025-01-31T10:00:00Z"
}
```

#### Single Vehicle Reading
```bash
POST /v1/telemetry/vehicle
Content-Type: application/json

{
  "vehicleId": "VH-001",
  "soc": 75.5,
  "kwhDeliveredDc": 45.2,
  "batteryTemp": 32.5,
  "timestamp": "2025-01-31T10:00:00Z"
}
```

#### Bulk Ingestion (Recommended for High Throughput)
```bash
POST /v1/telemetry/bulk
Content-Type: application/json

{
  "meters": [
    { "meterId": "METER-001", "kwhConsumedAc": 150.5, "voltage": 240.2, "timestamp": "2025-01-31T10:00:00Z" },
    { "meterId": "METER-002", "kwhConsumedAc": 220.3, "voltage": 238.5, "timestamp": "2025-01-31T10:00:00Z" }
  ],
  "vehicles": [
    { "vehicleId": "VH-001", "soc": 75.5, "kwhDeliveredDc": 127.9, "batteryTemp": 32.5, "timestamp": "2025-01-31T10:00:00Z" },
    { "vehicleId": "VH-002", "soc": 60.0, "kwhDeliveredDc": 187.3, "batteryTemp": 35.2, "timestamp": "2025-01-31T10:00:00Z" }
  ]
}
```

### Live Status (Hot Path - O(1) Lookup)

#### Get Meter Status
```bash
GET /v1/telemetry/meter/METER-001/status
```

#### Get Vehicle Status
```bash
GET /v1/telemetry/vehicle/VH-001/status
```

#### Get Queue Status
```bash
GET /v1/telemetry/queue/status
```

### Analytics

#### Get 24-Hour Vehicle Performance
```bash
GET /v1/analytics/performance/VH-001
```

**Response:**
```json
{
  "data": {
    "vehicleId": "VH-001",
    "meterId": "METER-001",
    "period": {
      "start": "2025-01-30T10:00:00Z",
      "end": "2025-01-31T10:00:00Z"
    },
    "metrics": {
      "totalAcConsumed": 500.5,
      "totalDcDelivered": 425.4,
      "efficiencyRatio": 85.0,
      "avgBatteryTemp": 33.2,
      "minBatteryTemp": 28.0,
      "maxBatteryTemp": 38.5
    },
    "alerts": []
  }
}
```

### Metrics
```bash
GET /v1/metrics
```
Returns Prometheus-compatible metrics.

---

## 🧪 Testing with cURL

```bash
# Health check
curl http://localhost:3000/health

# Ingest meter telemetry
curl -X POST http://localhost:3000/v1/telemetry/meter \
  -H "Content-Type: application/json" \
  -d '{"meterId":"METER-001","kwhConsumedAc":150.5,"voltage":240.2,"timestamp":"2025-01-31T10:00:00Z"}'

# Ingest vehicle telemetry
curl -X POST http://localhost:3000/v1/telemetry/vehicle \
  -H "Content-Type: application/json" \
  -d '{"vehicleId":"VH-001","soc":75.5,"kwhDeliveredDc":127.9,"batteryTemp":32.5,"timestamp":"2025-01-31T10:00:00Z"}'

# Get live status
curl http://localhost:3000/v1/telemetry/vehicle/VH-001/status

# Get analytics
curl http://localhost:3000/v1/analytics/performance/VH-001
```

---

## 📦 Postman Collection

Import the collection from:
```
nestjs-energy-ingestion/postman/Energy-Ingestion-API.postman_collection.json
```

---

## 🔥 Load Testing with k6

```bash
# Install k6
brew install k6  # macOS
# or: https://k6.io/docs/getting-started/installation/

# Run load test
cd nestjs-energy-ingestion
k6 run test/load/ingestion.k6.js
```

---

## 🛑 Stopping Services

```bash
docker-compose down

# Remove volumes (reset database)
docker-compose down -v
```
