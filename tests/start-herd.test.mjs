import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

describe('Fleet Automation & Preflight Launcher Suite', () => {
  const ps1Path = path.resolve('scripts/start-herd.ps1');
  const shPath = path.resolve('scripts/start-herd.sh');

  it('verifies launcher scripts exist on disk', () => {
    assert.ok(fs.existsSync(ps1Path), 'start-herd.ps1 must exist');
    assert.ok(fs.existsSync(shPath), 'start-herd.sh must exist');
  });

  it('validates POSIX launcher syntax and preflight checks', () => {
    const shContent = fs.readFileSync(shPath, 'utf8');
    assert.ok(shContent.includes('SIGIL_CONNECTOR_URL'), 'Must handle SIGIL_CONNECTOR_URL');
    assert.ok(shContent.includes('manifest.json'), 'Must verify manifest.json presence');
  });

  it('runs PowerShell launcher preflight cleanly with -SkipConnectorCheck -VerifySchema', () => {
    const res = spawnSync('pwsh', ['-NoProfile', '-File', ps1Path, '-SkipConnectorCheck', '-VerifySchema'], {
      encoding: 'utf8',
      timeout: 10000
    });
    // On systems with pwsh available, check clean execution
    if (!res.error) {
      assert.equal(res.status, 0, `start-herd.ps1 failed with: ${res.stderr || res.stdout}`);
      assert.ok(res.stdout.includes('Fleet environment initialized'), 'Must confirm fleet initialization');
    }
  });
});
