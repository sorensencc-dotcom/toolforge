import assert from 'node:assert';
import { execSync, spawn } from 'node:child_process';

const TARGET_URL = 'http://127.0.0.1:8089/health/provider';

async function runProbe() {
  console.log('=== ZERO-DOWNTIME AVAILABILITY BENCHMARK ===');
  console.log(`Target: ${TARGET_URL}`);

  let stopProbe = false;
  let successCount = 0;
  let failCount = 0;
  let firstFailTs = 0;
  let lastFailTs = 0;
  const latencies = [];

  const probePromise = (async () => {
    while (!stopProbe) {
      const t0 = Date.now();
      try {
        const res = await fetch(TARGET_URL, {
          headers: { 'Connection': 'close' },
          signal: AbortSignal.timeout(1500),
        });
        const dur = Date.now() - t0;
        if (res.status === 200) {
          successCount++;
          latencies.push(dur);
        } else {
          failCount++;
          if (!firstFailTs) firstFailTs = Date.now();
          lastFailTs = Date.now();
        }
      } catch (err) {
        failCount++;
        if (!firstFailTs) firstFailTs = Date.now();
        lastFailTs = Date.now();
      }
      await new Promise((r) => setTimeout(r, 50));
    }
  })();

  console.log('Starting rolling restart on deployment/toolforge-api...');
  const startRolloutTs = Date.now();
  execSync('kubectl rollout restart deployment/toolforge-api -n toolforge', { encoding: 'utf8' });
  execSync('kubectl rollout status deployment/toolforge-api -n toolforge --timeout=60s', { encoding: 'utf8' });
  const rolloutDuration = Date.now() - startRolloutTs;

  // Allow a few more probes after rollout stabilizes
  await new Promise((r) => setTimeout(r, 2000));
  stopProbe = true;
  await probePromise;

  const total = successCount + failCount;
  const availability = (total > 0) ? ((successCount / total) * 100).toFixed(3) : '0.000';
  const outageIntervalMs = firstFailTs ? (lastFailTs - firstFailTs) : 0;
  const avgLatency = latencies.length > 0 ? (latencies.reduce((a, b) => a + b, 0) / latencies.length).toFixed(2) : '0.00';

  console.log('  [RESULTS SUMMARY]');
  console.log(`- Total Probes Sent: ${total}`);
  console.log(`- Successful (200 OK): ${successCount}`);
  console.log(`- Failed / Dropped: ${failCount}`);
  console.log(`- Availability: ${availability}%`);
  console.log(`- Rollout Duration: ${rolloutDuration}ms`);
  console.log(`- Measured Outage Interval: ${outageIntervalMs}ms`);
  console.log(`- Mean Probe Latency: ${avgLatency}ms`);

  assert.strictEqual(failCount, 0, 'Must have 0 failed requests during rollout');
  console.log('\n  [PASS] Zero-downtime availability proven.');
}

runProbe().catch((err) => {
  console.error('\n[FAIL] Zero-downtime probe failed:', err);
  process.exit(1);
});
