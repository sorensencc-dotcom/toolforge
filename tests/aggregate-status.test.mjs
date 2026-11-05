import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test('scripts/aggregate_status.py generates valid status json with required sections', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agg-status-test-'));
  const outFile = path.join(tmpDir, 'status.json');
  const scriptPath = path.resolve(__dirname, '../scripts/aggregate_status.py');

  try {
    execFileSync('python', [scriptPath, outFile], { encoding: 'utf8', timeout: 30000 });
    assert.ok(fs.existsSync(outFile), 'status.json must be written');

    const content = JSON.parse(fs.readFileSync(outFile, 'utf8'));
    assert.ok(content.generated_at, 'generated_at must be present');
    assert.ok(typeof content.kb_sync === 'object', 'kb_sync must be an object');
    assert.ok(typeof content.todos === 'object', 'todos must be an object');
    assert.ok(typeof content.memory === 'object', 'memory must be an object');
    assert.ok(typeof content.handoff === 'object', 'handoff must be an object');
    assert.ok(typeof content.momentum === 'object', 'momentum must be an object');
    assert.ok(typeof content.system_health === 'object', 'system_health must be an object');
    assert.ok(Array.isArray(content.anomalies), 'anomalies must be an array');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
