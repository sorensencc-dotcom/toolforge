import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process'; // noqa: SEC-AUDITOR -- fixed Node executable, copied local launcher, shell:false; no external services.

const source = readFileSync(new URL('./assert-test-count.mjs', import.meta.url), 'utf8');

function fixture(t, { file = 'space & quote\'$HOME`;literal.test.ts', cli = "console.log('CLI_ARGS:'+JSON.stringify(process.argv.slice(2))); console.log('# tests 35');", installed = true } = {}) {
  // Never execute old launcher: its npx fallback could download dependencies.
  assert.match(source, /shell:\s*false/);
  const root = mkdtempSync(join(tmpdir(), 'parallel-launcher-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'scripts'));
  mkdirSync(join(root, 'src'));
  writeFileSync(join(root, 'scripts/assert-test-count.mjs'), source);
  if (file) writeFileSync(join(root, 'src', file), '');
  writeFileSync(join(root, 'src/index.smoke.test.ts'), '');
  if (installed) {
    mkdirSync(join(root, 'node_modules/tsx'), { recursive: true });
    writeFileSync(join(root, 'node_modules/tsx/package.json'), JSON.stringify({ name: 'tsx', type: 'module', exports: { './cli': './cli.mjs' } }));
    writeFileSync(join(root, 'node_modules/tsx/cli.mjs'), cli);
  }
  return spawnSync(process.execPath, [join(root, 'scripts/assert-test-count.mjs')], { cwd: root, shell: false, encoding: 'utf8', timeout: 10000 });
}

test('launcher uses installed tsx and literal shell-free arguments', t => {
  assert.doesNotMatch(source, /spawnSync\(["']npx["']/);
  const result = fixture(t);
  assert.equal(result.status, 0, result.stderr);
  const args = JSON.parse(result.stdout.match(/CLI_ARGS:(.*)/)[1]);
  assert.deepEqual(args, ['--test', join('src', "space & quote'$HOME`;literal.test.ts")]);
});

test('missing installed runtime fails without install fallback', t => {
  const result = fixture(t, { installed: false });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Installed tsx runtime unavailable/);
  assert.doesNotMatch(result.stdout, /CLI_ARGS/);
});

test('no non-smoke tests fails before runtime execution', t => {
  const result = fixture(t, { file: null, installed: false });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /No test files matched/);
});

test('minimum test-count gate remains enforced', t => {
  const result = fixture(t, { cli: "console.log('# tests 34');" });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Expected at least 35 tests/);
});

test('native child failure is preserved even when count passes', t => {
  const result = fixture(t, { cli: "console.log('# tests 35'); console.error('fixture failure'); process.exit(7);" });
  assert.equal(result.status, 7);
  assert.match(result.stderr, /fixture failure/);
});

test('signalled child cannot become successful exit', t => {
  const result = fixture(t, { cli: "console.log('# tests 35'); process.kill(process.pid, 'SIGTERM');" });
  assert.notEqual(result.status, 0);
});
