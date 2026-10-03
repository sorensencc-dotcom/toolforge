import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { DuckDBAnalyticsEngine } from '../rewrite-mcp/src/analytics/DuckDBAnalyticsEngine.ts';

test('DuckDBAnalyticsEngine initializes safely and executes fallback query', async () => {
  const engine = new DuckDBAnalyticsEngine({ maxMemory: '256MB', threads: 2 });
  await engine.initialize();

  // In environment without @duckdb/node-api, isNative() is false (fallback active)
  assert.equal(typeof engine.isNative(), 'boolean');

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'engine-test-'));
  const logFile = path.join(tmpDir, 'test.jsonl');

  const lines = [
    JSON.stringify({
      step_index: 1,
      type: 'PLANNER_RESPONSE',
      prompt_tokens: 500,
      completion_tokens: 100,
      duration_ms: 120,
      tool_name: 'view_file',
      status: 'SUCCESS',
    }),
  ];
  fs.writeFileSync(logFile, lines.join('\n'), 'utf8');

  try {
    const rows = await engine.query('SELECT 1', logFile);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].totalSteps, 1);
    assert.equal(rows[0].totalTokens, 600);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    await engine.close();
  }
});
