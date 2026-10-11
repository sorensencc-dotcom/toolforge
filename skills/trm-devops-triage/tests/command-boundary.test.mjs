import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process'; // noqa: SEC-AUDITOR -- current Node + disposable fixed fake CLI, shell:false; no real triage action.

const require = createRequire(import.meta.url);
const ts = createRequire(new URL('../../slop-grader-sweep/package.json', import.meta.url))('typescript');
const source = readFileSync(new URL('../src/index.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;

function load({ execute, exists = () => true, dirname = path.resolve('fixture/skills/trm-devops-triage/src') } = {}) {
  const calls = [];
  const exports = {};
  const localRequire = name => {
    if (name === 'node:child_process' || name === 'child_process') return {
      execSync: () => { throw new Error('Unsafe shell execution'); },
      execFileSync: (...args) => { calls.push(args); return execute?.(...args); },
    };
    if (name === 'node:fs') return { existsSync: exists };
    return require(name);
  };
  vm.runInNewContext(compiled, { exports, module: { exports }, require: localRequire, __dirname: dirname, process });
  return { exports, calls };
}

test('TRM paths are literal argv and invocation uses fixed local built CLI, no shell', () => {
  const { exports, calls } = load();
  const hostile = "space & quote'$HOME`;literal";
  exports.runTriageCommand('sync', { queuePath: hostile, archivePath: hostile, bufferPath: hostile, dryRun: true });
  const [executable, args, options] = calls[0];
  assert.equal(executable, process.execPath);
  assert.deepEqual(Array.from(args), [path.resolve('fixture/modules/trm-devops/dist/cli/index.js'), 'sync', '--queue', hostile, '--archive', hostile, '--buffer', hostile, '--dry-run']);
  assert.equal(options.shell, false);
  assert.equal(options.cwd, path.resolve('fixture'));
  assert.equal(options.stdio, 'inherit');
});

test('all supported commands and runStatus retain contracts', () => {
  const { exports, calls } = load();
  exports.runTriageCommand('prune');
  exports.runStatus();
  assert.deepEqual(calls.map(call => Array.from(call[1]).slice(1)), [['prune'], ['status']]);
});

test('unknown command is rejected before subprocess', () => {
  const { exports, calls } = load();
  assert.throws(() => exports.runTriageCommand('status & injected'), /Unsupported triage command/);
  assert.equal(calls.length, 0);
});

test('missing local build fails without npx or download', () => {
  const { exports, calls } = load({ exists: () => false });
  assert.throws(() => exports.runStatus(), /TRM DevOps CLI build unavailable/);
  assert.equal(calls.length, 0);
});

test('native CLI failure propagates rather than reporting success', () => {
  const cause = new Error('fixture native failure');
  const { exports } = load({ execute: () => { throw cause; } });
  assert.throws(() => exports.runStatus(), error => error === cause);
});

test('real child receives shell-like values unchanged in disposable fixture', t => {
  const root = mkdtempSync(path.join(tmpdir(), 'trm-boundary-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const cli = path.join(root, 'modules/trm-devops/dist/cli/index.js');
  mkdirSync(path.dirname(cli), { recursive: true });
  writeFileSync(cli, 'console.log(JSON.stringify(process.argv.slice(2)));');
  let actual;
  const { exports } = load({ dirname: path.join(root, 'skills/trm-devops-triage/src'), execute: (exe, args, options) => {
    actual = JSON.parse(execFileSync(exe, args, { ...options, stdio: 'pipe', encoding: 'utf8' }));
  } });
  const literal = "queue space & quote'$HOME`;literal.md";
  exports.runTriageCommand('status', { queuePath: literal });
  assert.deepEqual(actual, ['status', '--queue', literal]);
});
