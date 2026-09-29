import { describe, it } from 'node:test';
import assert from 'node:assert';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import handler, { runMonitor, inspectTaskTelemetry, REQUIRED_FLEET_TASKS } from '../src/index.js';

describe('ironbots-fleet-status-monitor', () => {
  it('defines 9 canonical fleet tasks', () => {
    assert.strictEqual(REQUIRED_FLEET_TASKS.length, 9);
    assert.ok(REQUIRED_FLEET_TASKS.includes('Notebook-Ingester'));
    assert.ok(REQUIRED_FLEET_TASKS.includes('Ironbots-Reporter'));
  });

  it('handles missing telemetry feed gracefully', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fleet-test-'));
    try {
      const res = await runMonitor({
        action: 'status',
        statusFeedDir: tmpDir
      });

      assert.strictEqual(res.totalTasks, 9);
      assert.strictEqual(res.healthyCount, 0);
      assert.strictEqual(res.tasks.length, 9);
      assert.strictEqual(res.tasks[0].status, 'UNKNOWN');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('aggregates healthy and failing task telemetry accurately', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fleet-test-'));
    try {
      // Write mock healthy report
      fs.writeFileSync(
        path.join(tmpDir, 'notebook_ingester_report.json'),
        JSON.stringify({ status: 'HEALTHY', timestamp: new Date().toISOString(), processed: 10 })
      );

      // Write mock failed report
      fs.writeFileSync(
        path.join(tmpDir, 'daemon_health.json'),
        JSON.stringify({ status: 'FAILED', message: 'Process crashed with OOM' })
      );

      const res = await runMonitor({
        action: 'aggregate',
        statusFeedDir: tmpDir
      });

      assert.strictEqual(res.status, 'error');
      assert.strictEqual(res.failedCount, 1);
      assert.strictEqual(res.healthyCount, 1);
      assert.ok(res.alerts.some(a => a.includes('Daemon-Healer')));
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('throws error when action is omitted', async () => {
    await assert.rejects(async () => {
      await handler({} as any);
    }, /Missing required property: action/);
  });
});
