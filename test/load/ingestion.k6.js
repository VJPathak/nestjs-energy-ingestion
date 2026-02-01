import http from 'k6/http';
import { check, sleep } from 'k6';
import { randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

export const options = {
  stages: [
    { duration: '30s', target: 50 },   // Ramp up to 50 users
    { duration: '1m', target: 100 },   // Stay at 100 users
    { duration: '30s', target: 200 },  // Spike to 200 users
    { duration: '1m', target: 200 },   // Stay at 200 users
    { duration: '30s', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests should be under 500ms
    http_req_failed: ['rate<0.01'],   // Less than 1% failure rate
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000/v1';

// Generate random meter telemetry
function generateMeterTelemetry() {
  return {
    meterId: `METER-${String(randomIntBetween(1, 10000)).padStart(5, '0')}`,
    kwhConsumedAc: randomIntBetween(10, 500) + Math.random(),
    voltage: 220 + Math.random() * 30,
    timestamp: new Date().toISOString(),
  };
}

// Generate random vehicle telemetry
function generateVehicleTelemetry() {
  return {
    vehicleId: `VH-${String(randomIntBetween(1, 10000)).padStart(5, '0')}`,
    soc: randomIntBetween(10, 100),
    kwhDeliveredDc: randomIntBetween(5, 450) + Math.random(),
    batteryTemp: 20 + Math.random() * 35,
    timestamp: new Date().toISOString(),
  };
}

// Generate bulk payload
function generateBulkPayload(meterCount, vehicleCount) {
  const meters = [];
  const vehicles = [];
  
  for (let i = 0; i < meterCount; i++) {
    meters.push(generateMeterTelemetry());
  }
  
  for (let i = 0; i < vehicleCount; i++) {
    vehicles.push(generateVehicleTelemetry());
  }
  
  return { meters, vehicles };
}

export default function () {
  const scenario = randomIntBetween(1, 10);
  
  if (scenario <= 3) {
    // 30% - Single meter ingestion
    const payload = generateMeterTelemetry();
    const res = http.post(`${BASE_URL}/telemetry/meter`, JSON.stringify(payload), {
      headers: { 'Content-Type': 'application/json' },
    });
    
    check(res, {
      'meter ingestion status is 202': (r) => r.status === 202,
      'meter ingestion response time < 100ms': (r) => r.timings.duration < 100,
    });
    
  } else if (scenario <= 6) {
    // 30% - Single vehicle ingestion
    const payload = generateVehicleTelemetry();
    const res = http.post(`${BASE_URL}/telemetry/vehicle`, JSON.stringify(payload), {
      headers: { 'Content-Type': 'application/json' },
    });
    
    check(res, {
      'vehicle ingestion status is 202': (r) => r.status === 202,
      'vehicle ingestion response time < 100ms': (r) => r.timings.duration < 100,
    });
    
  } else if (scenario <= 9) {
    // 30% - Bulk ingestion
    const payload = generateBulkPayload(
      randomIntBetween(50, 200),
      randomIntBetween(50, 200)
    );
    const res = http.post(`${BASE_URL}/telemetry/bulk`, JSON.stringify(payload), {
      headers: { 'Content-Type': 'application/json' },
    });
    
    check(res, {
      'bulk ingestion status is 200': (r) => r.status === 200,
      'bulk ingestion response time < 1000ms': (r) => r.timings.duration < 1000,
    });
    
  } else {
    // 10% - Analytics query
    const vehicleId = `VH-${String(randomIntBetween(1, 100)).padStart(5, '0')}`;
    const res = http.get(`${BASE_URL}/analytics/performance/${vehicleId}`);
    
    check(res, {
      'analytics returns 200 or 404': (r) => r.status === 200 || r.status === 404,
      'analytics response time < 500ms': (r) => r.timings.duration < 500,
    });
  }
  
  sleep(0.1); // 100ms between requests
}

export function handleSummary(data) {
  return {
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
    'summary.json': JSON.stringify(data),
  };
}

function textSummary(data, opts) {
  const indent = opts.indent || '  ';
  let output = '\n=== K6 Load Test Summary ===\n\n';
  
  output += `${indent}Scenarios run: ${data.root_group.checks.length}\n`;
  output += `${indent}Total requests: ${data.metrics.http_reqs.values.count}\n`;
  output += `${indent}Request rate: ${data.metrics.http_reqs.values.rate.toFixed(2)}/s\n`;
  output += `${indent}Avg duration: ${data.metrics.http_req_duration.values.avg.toFixed(2)}ms\n`;
  output += `${indent}P95 duration: ${data.metrics.http_req_duration.values['p(95)'].toFixed(2)}ms\n`;
  output += `${indent}Failed: ${data.metrics.http_req_failed.values.rate.toFixed(4)}%\n`;
  
  return output;
}
