import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveDefectContext } from '../src/core/viking-resolver.ts';

function clientFor(resultsByTier: Record<string, any>) {
  const calls: Array<{ items: any[] }> = [];
  return {
    calls,
    async batchRead(items: any[]) {
      calls.push({ items });
      const tier = items[0]?.tier;
      return { snapshot_id: '20260830-120000', results: resultsByTier[tier] };
    },
    telemetry: { snapshot: () => ({ rpc_call_count: calls.length }) },
  };
}

test('P1 triage batches L1 reads and escalates only stale evidence in one L2 batch', async () => {
  const client = clientFor({
    L1: [
      { uri: 'viking://kb-sync/sources/auth.ts', ok: true, value: { content: 'auth overview', stale: true, resolution_tier: 'L1' } },
      { uri: 'viking://kb-sync/sources/config.ts', ok: true, value: { content: 'config overview', stale: false, resolution_tier: 'L1' } },
    ],
    L2: [{ uri: 'viking://kb-sync/sources/auth.ts', ok: true, value: { content: 'auth source', stale: false, resolution_tier: 'L2' } }],
  });

  const result = await resolveDefectContext(
    { blastRadius: 'P1', primarySuspects: ['auth.ts', 'config.ts'] },
    { mode: 'viking', vault: 'kb-sync', client },
  );

  assert.equal(client.calls.length, 2);
  assert.deepEqual(client.calls[1].items, [{ uri: 'viking://kb-sync/sources/auth.ts', tier: 'L2' }]);
  assert.equal(result.evidence[0].content, 'auth source');
  assert.equal(result.evidence[0].fallbackReason, 'STALE_HIGH_SEVERITY');
  assert.equal(result.evidence[1].content, 'config overview');
  assert.equal(result.telemetry.rpc_call_count, 2);
});

test('P3 triage retains stale L1 evidence and adds an operator note', async () => {
  const client = clientFor({
    L1: [{ uri: 'viking://kb-sync/sources/worker.ts', ok: true, value: { content: 'worker overview', stale: true, resolution_tier: 'L1' } }],
  });

  const result = await resolveDefectContext(
    { blastRadius: 'P3', primarySuspects: ['worker.ts'] },
    { mode: 'viking', vault: 'kb-sync', client },
  );

  assert.equal(client.calls.length, 1);
  assert.equal(result.evidence[0].resolvedTier, 'L1');
  assert.match(result.operatorNotes[0], /VIKING_STALE_L1/);
});

test('unavailable L1 evidence falls back to L2 without exposing the RPC error', async () => {
  const client = clientFor({
    L1: [{ uri: 'viking://kb-sync/sources/new.ts', ok: false, error: { vikingCode: 'TIER_UNAVAILABLE', message: 'missing tier' } }],
    L2: [{ uri: 'viking://kb-sync/sources/new.ts', ok: true, value: { content: 'new source', stale: false, resolution_tier: 'L2' } }],
  });

  const result = await resolveDefectContext(
    { blastRadius: 'P2', primarySuspects: ['new.ts'] },
    { mode: 'viking', vault: 'kb-sync', client },
  );

  assert.equal(result.evidence[0].content, 'new source');
  assert.equal(result.evidence[0].fallbackReason, 'TIER_UNAVAILABLE');
  assert.equal(result.evidence[0].error, undefined);
});

test('raw mode preserves the recursive baseline loader and bypasses Viking RPCs', async () => {
  const loaded: string[] = [];
  const result = await resolveDefectContext(
    { blastRadius: 'P2', primarySuspects: ['src/a.ts', 'src/b.ts'] },
    { mode: 'raw', vault: 'kb-sync', rawLoader: async (path) => { loaded.push(path); return `raw:${path}`; } },
  );

  assert.deepEqual(loaded, ['src/a.ts', 'src/b.ts']);
  assert.equal(result.mode, 'raw');
  assert.deepEqual(result.evidence.map((item) => item.content), ['raw:src/a.ts', 'raw:src/b.ts']);
  assert.equal(result.telemetry.rpc_call_count, 0);
});
