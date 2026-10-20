import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const SCRIPT = fileURLToPath(new URL('../scripts/run-weekly-retro.ps1', import.meta.url));
const PWSH = 'pwsh';

function runWeekly(consolidatorExit) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'weekly-retro-'));
  const scripts = path.join(root, 'scripts');
  fs.mkdirSync(scripts);
  const order = path.join(root, 'order.txt');
  const stub = (name, exit) => fs.writeFileSync(
    path.join(scripts, name),
    `import fs from 'node:fs';\nfs.appendFileSync(${JSON.stringify(order)}, '${name}\\n');\nprocess.exit(${exit});\n`,
  );
  stub('consolidate-retro-inbox.mjs', consolidatorExit);
  stub('compile-weekly-retro.mjs', 0);
  const result = spawnSync(PWSH, [
    '-NoProfile', '-File', SCRIPT,
    '-RepoRoot', root,
    '-OutputDir', path.join(root, 'out'),
    '-LogDir', path.join(root, 'log'),
    '-RunnerExe', process.execPath,
  ], { encoding: 'utf8' });
  const ran = fs.existsSync(order) ? fs.readFileSync(order, 'utf8').trim().split(/\r?\n/) : [];
  fs.rmSync(root, { recursive: true, force: true });
  return { result, ran };
}

test('weekly retro consolidates the inbox before compiling the report', () => {
  const { result, ran } = runWeekly(0);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(ran, ['consolidate-retro-inbox.mjs', 'compile-weekly-retro.mjs']);
});

test('a consolidator failure does not stop the report', () => {
  const { result, ran } = runWeekly(1);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(ran, ['consolidate-retro-inbox.mjs', 'compile-weekly-retro.mjs']);
});
