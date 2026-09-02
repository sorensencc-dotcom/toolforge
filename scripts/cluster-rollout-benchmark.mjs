import assert from 'node:assert';
import fs from 'node:fs';
import { execSync } from 'node:child_process';

const inPodScript = `
require('fs');
const fs = require('fs');
const target = 'http://toolforge-api-service.toolforge.svc.cluster.local/health/provider';
let success = 0;
let fail = 0;
let firstFailTs = 0;
let lastFailTs = 0;
const latencies = [];

function writeStats() {
  const total = success + fail;
  const availability = total > 0 ? ((success / total) * 100).toFixed(3) : '0.000';
  const outageIntervalMs = firstFailTs ? (lastFailTs - firstFailTs) : 0;
  const avgLatency = latencies.length > 0 ? (latencies.reduce((a, b) => a + b, 0) / latencies.length).toFixed(2) : '0.00';
  fs.writeFileSync('/tmp/probe-results.json', JSON.stringify({
    total,
    success,
    fail,
    availability,
    outageIntervalMs,
    avgLatency,
  }, null, 2), 'utf8');
}

async function run() {
  while (true) {
    const t0 = Date.now();
    try {
      const res = await fetch(target, { 
        headers: { 'Connection': 'close' },
        signal: AbortSignal.timeout(1000) 
      });
      const dur = Date.now() - t0;
      if (res.status === 200) {
        success++;
        latencies.push(dur);
      } else {
        fail++;
        if (!firstFailTs) firstFailTs = Date.now();
        lastFailTs = Date.now();
      }
    } catch (err) {
      fail++;
      if (!firstFailTs) firstFailTs = Date.now();
      lastFailTs = Date.now();
    }
    writeStats();
    await new Promise((r) => setTimeout(r, 50));
  }
}

run();
`;


async function runBenchmark() {
  console.log('=== IN-CLUSTER ZERO-DOWNTIME AVAILABILITY BENCHMARK ===');
  fs.writeFileSync('scripts/in-pod-probe.js', inPodScript, 'utf8');
  execSync(`kubectl cp scripts/in-pod-probe.js toolforge/probe-runner:/in-pod-probe.js`);
  console.log('Probe script copied to probe-runner pod.');


  try {
    execSync('kubectl exec probe-runner -n toolforge -- pkill -f in-pod-probe', { encoding: 'utf8' });
  } catch {}
  try {
    execSync('kubectl exec probe-runner -n toolforge -- rm -f /tmp/probe-results.json', { encoding: 'utf8' });
  } catch {}

  console.log('Starting background probe on probe-runner pod...');
  execSync('kubectl exec probe-runner -n toolforge -- sh -c "nohup node /in-pod-probe.js > /tmp/probe.log 2>&1 &"', { encoding: 'utf8' });

  await new Promise((r) => setTimeout(r, 2000));

  console.log('Triggering rolling restart on deployment/toolforge-api -- maxSurge=1, maxUnavailable=0...');
  const startRolloutTs = Date.now();
  execSync('kubectl rollout restart deployment/toolforge-api -n toolforge', { encoding: 'utf8' });
  execSync('kubectl rollout status deployment/toolforge-api -n toolforge --timeout=60s', { encoding: 'utf8' });
  const rolloutDuration = Date.now() - startRolloutTs;
  console.log(`Rollout successfully completed in ${rolloutDuration}ms.`);


  await new Promise((r) => setTimeout(r, 2000));


  console.log('Reading in-cluster probe results...');
  const rawResults = execSync('kubectl exec probe-runner -n toolforge -- cat /tmp/probe-results.json', { encoding: 'utf8' });
  console.log('Raws', rawResults);
  const parsed = JSON.parse(rawResults);


  try {
    execSync('kubectl exec probe-runner -n toolforge -- pkill -f in-pod-probe', { encoding: 'utf8' });
  } catch {}

  console.log('  [IN-CLUSTER ZERO-DOWNTIME RESULTS]');
  console.log(`- Total In-Cluster Probes Sent: ${parsed.total}`);
  console.log(`- Successful (200 OK): ${parsed.success}` + (` (${parsed.availability}%)`));
  console.log(`- Failed / Dropped Requests: ${parsed.fail}`);
  const measuredOutage = parsed.outageIntervalMs || 0;
  console.log(`- Measured Outage Interval: ${measuredOutage}ms`);
  console.log(`- Mean Probe Latency: ${parsed.avgLatency}ms`);
  console.log(`- Rollout Duration: ${rolloutDuration}ms`);

  assert.strictEqual(parsed.fail, 0, 'Must have 0 failed requests during in-cluster rollout');
  assert.strictEqual(parsed.availability, '100.000', 'Must have 100.000% availability');
  console.log('\n  [PASS] Zero-downtime availability proven mathematically at 100.000% (0,000ms outage).');
}

runBenchmark().catch((err) => {
  console.error('\n[FAIL] In-cluster benchmark failed:', err);
  process.exit(1);
});
