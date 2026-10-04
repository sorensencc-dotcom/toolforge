import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const script = resolve('scripts/check-retro-needed.ps1');

function run(retroNames, date) {
  const dir = mkdtempSync(join(tmpdir(), 'retros-'));
  try {
    for (const name of retroNames) writeFileSync(join(dir, name), '{}');
    const result = spawnSync(
      'pwsh',
      ['-NoProfile', '-File', script, '-RetroDir', dir, '-Date', date],
      { encoding: 'utf8', timeout: 30000 },
    );
    return { status: result.status, out: result.stdout };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('warns when newest retro is at least 7 days old', () => {
  const { status, out } = run(['2026-09-27-1.json'], '2026-10-04');
  assert.equal(status, 0);
  assert.match(out, /WARN: newest retro 2026-09-27-1\.json is 7 days old/);
  assert.match(out, /PROCEED: no retro filed today yet/);
});

test('stays quiet when newest retro is fresh', () => {
  const { status, out } = run(['2026-10-03-1.json'], '2026-10-04');
  assert.equal(status, 0);
  assert.doesNotMatch(out, /WARN/);
});

test('picks the newest retro by date, not by name order', () => {
  const { out } = run(['2026-09-01-1.json', '2026-10-02-1.json', '2026-09-15-9.json'], '2026-10-04');
  assert.doesNotMatch(out, /WARN/);
});
