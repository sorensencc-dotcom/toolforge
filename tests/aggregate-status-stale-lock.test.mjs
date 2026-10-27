import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync, utimesSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

test('aggregate_status auto-recovers stale AST sync locks older than 5 minutes', (t) => {
  const repoRoot = process.env.DEV_ROOT || 'C:/dev';
  const fixtureDir = join(repoRoot, 'toolforge', 'graft', '.cache');
  if (!existsSync(fixtureDir)) {
    mkdirSync(fixtureDir, { recursive: true });
  }

  const lockFile = join(fixtureDir, '.sync.lock');
  const statsFile = join(fixtureDir, 'stats.json');

  // Preserve existing stats if present
  let originalStats = null;
  if (existsSync(statsFile)) {
    try {
      originalStats = readFileSync(statsFile, 'utf8');
    } catch {}
  }

  try {
    // 1. Stage orphan lock with dead PID and 10-minute age
    writeFileSync(lockFile, 'pid: 999999', 'utf8');
    const tenMinutesAgo = new Date(Date.now() - 600 * 1000);
    utimesSync(lockFile, tenMinutesAgo, tenMinutesAgo);

    const testStats = {
      dirty: true,
      syncing: true,
      nodeCount: 100,
    };
    writeFileSync(statsFile, JSON.stringify(testStats, null, 2), 'utf8');

    // 2. Execute status aggregator
    const res = spawnSync('python', [join(repoRoot, 'scripts', 'aggregate_status.py')], {
      encoding: 'utf8',
      cwd: repoRoot,
    });

    assert.equal(res.status, 0, `aggregate_status.py must exit 0: ${res.stderr}`);

    // 3. Assert lock is cleared and syncing is reset
    assert.equal(existsSync(lockFile), false, 'orphan .sync.lock must be removed');
    const updatedStats = JSON.parse(readFileSync(statsFile, 'utf8'));
    assert.equal(updatedStats.syncing, false, 'stats.json syncing must be reset to false');
    assert.ok(updatedStats.dirty_recovered_at, 'dirty_recovered_at timestamp must be stamped');
  } finally {
    if (existsSync(lockFile)) {
      try { rmSync(lockFile, { force: true }); } catch {}
    }
    if (originalStats !== null) {
      writeFileSync(statsFile, originalStats, 'utf8');
    } else if (existsSync(statsFile)) {
      try { rmSync(statsFile, { force: true }); } catch {}
    }
  }
});
