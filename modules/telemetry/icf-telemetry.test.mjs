import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { collectIcfTelemetry, formatPrometheusMetrics, writePrometheusMetrics, fetchHeadroomMetrics } from './icf-ingestion-hook.mjs';
import { IcfWebSocketServer } from './icf-ws-server.mjs';

describe('ICF Telemetry Collector & Exporter', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'icf-telemetry-test-'));
  const tempVault = path.join(tempDir, 'obsidian', 'vault');
  fs.mkdirSync(tempVault, { recursive: true });

  test('collects baseline telemetry from current repo', () => {
    const telemetry = collectIcfTelemetry(process.cwd(), tempVault);
    assert.equal(telemetry.source, 'Iron Command Forge (ICF)');
    assert.ok(typeof telemetry.timestamp === 'string');
    assert.ok(['CLEAN', 'DEGRADED'].includes(telemetry.overall_status));
    assert.ok(typeof telemetry.active_worktrees_count === 'number');
    assert.ok(Array.isArray(telemetry.worktrees));
    assert.ok(typeof telemetry.vault_status === 'object');
    assert.equal(telemetry.vault_status.vault_initialized, true);
  });

  test('formats prometheus metrics exposition format accurately', () => {
    const mockTelemetry = {
      overall_status: 'CLEAN',
      active_worktrees_count: 2,
      worktrees: [
        { path: 'wt1', branch: 'main', head: '12345678', isClean: true, dirtyCount: 0 },
        { path: 'wt2', branch: 'feat', head: '87654321', isClean: false, dirtyCount: 2 }
      ],
      vault_status: {
        vault_initialized: true,
        staging_active: true,
        staged_batches: 3,
        concurrency_locked: false,
        recovery_pending: false
      },
      headroom: {
        online: true,
        tokens_saved: 2083,
        hit_rate: 69.6,
        cost_savings_usd: 0.0299
      }
    };

    const prom = formatPrometheusMetrics(mockTelemetry);
    assert.ok(prom.includes('icf_worktrees_active 2'));
    assert.ok(prom.includes('icf_worktrees_dirty 1'));
    assert.ok(prom.includes('icf_vault_staging_active 1'));
    assert.ok(prom.includes('icf_vault_staged_batches 3'));
    assert.ok(prom.includes('icf_vault_concurrency_locked 0'));
    assert.ok(prom.includes('icf_status_clean 1'));
    assert.ok(prom.includes('icf_headroom_online 1'));
    assert.ok(prom.includes('icf_headroom_tokens_saved_total 2083'));
    assert.ok(prom.includes('icf_headroom_cache_hit_rate_pct 69.6'));
    assert.ok(prom.includes('icf_headroom_cost_avoided_usd 0.0299'));
  });

  test('writes metrics to disk', () => {
    const promFile = path.join(tempDir, 'metrics.prom');
    const mockTelemetry = {
      overall_status: 'CLEAN',
      active_worktrees_count: 1,
      worktrees: [{ path: 'wt', branch: 'main', head: '12345678', isClean: true, dirtyCount: 0 }],
      vault_status: {
        vault_initialized: true,
        staging_active: false,
        staged_batches: 0,
        concurrency_locked: false,
        recovery_pending: false
      }
    };

    writePrometheusMetrics(mockTelemetry, promFile);
    assert.ok(fs.existsSync(promFile));
    const content = fs.readFileSync(promFile, 'utf8');
    assert.ok(content.includes('icf_status_clean 1'));
  });

  test('fetchHeadroomMetrics handles offline proxy gracefully', async () => {
    const res = await fetchHeadroomMetrics(59999);
    assert.equal(res.online, false);
  });

  test('fetchHeadroomMetrics fetches live metrics when port matches', async () => {
    const res = await fetchHeadroomMetrics(8787);
    assert.ok(typeof res.online === 'boolean');
    if (res.online) {
      assert.ok(typeof res.tokens_saved === 'number');
      assert.ok(typeof res.hit_rate === 'number');
      assert.ok(typeof res.cost_savings_usd === 'number');
    }
  });

  test('WebSocket server starts, handles health check, and closes', async () => {
    const wsServer = new IcfWebSocketServer({ port: 18765 });
    const port = await wsServer.start();
    assert.equal(port, 18765);

    const res = await fetch(`http://127.0.0.1:${port}/health`);
    const json = await res.json();
    assert.equal(json.status, 'ok');

    await wsServer.close();
  });
});

