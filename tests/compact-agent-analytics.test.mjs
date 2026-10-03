import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { runCompaction } from '../scripts/compact-agent-analytics.mjs';

test('runCompaction partitions raw JSONL files into date-scoped folders and cleans staging', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'compactor-test-'));
  const rawDir = path.join(tmpDir, 'raw');
  const partitionDir = path.join(tmpDir, 'partitions');
  fs.mkdirSync(rawDir, { recursive: true });

  const rawFile1 = path.join(rawDir, 'sess-1.jsonl');
  const lines1 = [
    JSON.stringify({
      session_id: 's1',
      timestamp: '2026-10-03T10:00:00.000Z',
      tool_name: 'view_file',
      duration_ms: 200,
    }),
    JSON.stringify({
      session_id: 's1',
      timestamp: '2026-10-03T10:05:00.000Z',
      tool_name: 'run_command',
      duration_ms: 500,
    }),
  ];
  fs.writeFileSync(rawFile1, lines1.join('\n'), 'utf8');

  try {
    const stats = await runCompaction({ rawDir, partitionDir });
    assert.equal(stats.filesProcessed, 1);
    assert.equal(stats.totalRecords, 2);
    assert.equal(stats.partitionsCreated, 1);
    assert.deepEqual(stats.partitions, ['year=2026/month=10/day=03']);

    // Assert raw file is pruned
    assert.equal(fs.existsSync(rawFile1), false);

    // Assert partition file created
    const partitionDayDir = path.join(partitionDir, 'year=2026', 'month=10', 'day=03');
    assert.equal(fs.existsSync(partitionDayDir), true);
    const partitionFiles = fs.readdirSync(partitionDayDir);
    assert.ok(partitionFiles.length >= 1);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
