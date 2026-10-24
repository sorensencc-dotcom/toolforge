import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runWithTimeout, findHangingFile, clearLocks, classifyRun, retryArgs } from '../src/index.mjs';

function fakeChild() {
  const c = new EventEmitter();
  c.pid = 4242;
  c.stdout = new EventEmitter();
  c.stderr = new EventEmitter();
  return c;
}

test('classifyRun: pass, fail, hung', () => {
  assert.equal(classifyRun({ code: 0, output: 'ok 1' }), 'pass');
  assert.equal(classifyRun({ code: 1, output: 'not ok' }), 'fail');
  assert.equal(classifyRun({ code: null, output: 'x', timedOut: 'idle' }), 'hung');
});

test('classifyRun never calls silent exit 0 a pass', () => {
  assert.equal(classifyRun({ code: 0, output: '  ' }), 'fail');
});

test('runWithTimeout kills the tree on idle and reports it', async () => {
  const child = fakeChild();
  const killed = [];
  const p = runWithTimeout('x', [], { spawn: () => child, kill: (pid) => killed.push(pid), idleMs: 20, timeoutMs: 1000 });
  child.stdout.emit('data', 'hello');
  const r = await new Promise((res) => {
    p.then(res);
    setTimeout(() => child.emit('close', null), 60);
  });
  assert.deepEqual(killed, [4242]);
  assert.equal(r.timedOut, 'idle');
  assert.equal(r.code, null);
  assert.equal(r.output, 'hello');
});

test('runWithTimeout enforces the hard cap even when output keeps flowing', async () => {
  const child = fakeChild();
  const killed = [];
  const p = runWithTimeout('x', [], { spawn: () => child, kill: (pid) => killed.push(pid), idleMs: 500, timeoutMs: 30 });
  const iv = setInterval(() => child.stdout.emit('data', '.'), 5);
  setTimeout(() => child.emit('close', null), 80);
  const r = await p;
  clearInterval(iv);
  assert.equal(r.timedOut, 'hard');
  assert.equal(killed.length, 1);
});

test('runWithTimeout passes through a normal exit', async () => {
  const child = fakeChild();
  const p = runWithTimeout('x', [], { spawn: () => child, kill: () => assert.fail('no kill'), idleMs: 1000, timeoutMs: 1000 });
  child.stdout.emit('data', 'ok 1 - a');
  child.emit('close', 0);
  const r = await p;
  assert.deepEqual({ code: r.code, timedOut: r.timedOut }, { code: 0, timedOut: null });
});

test('findHangingFile: TAP, last started file without a result', () => {
  const out = [
    '# Subtest: tests/a.test.mjs', 'ok 1 - tests/a.test.mjs',
    '# Subtest: tests/b.test.mjs',
  ].join('\n');
  assert.equal(findHangingFile(out), 'tests/b.test.mjs');
});

test('findHangingFile: spec reporter markers', () => {
  const out = ['▶ src/x.test.js', '✔ src/x.test.js (4ms)', '▶ src/y.test.js'].join('\n');
  assert.equal(findHangingFile(out), 'src/y.test.js');
});

test('findHangingFile falls back to the last file-like path, else null', () => {
  assert.equal(findHangingFile('running tests/c.spec.ts now'), 'tests/c.spec.ts');
  assert.equal(findHangingFile('nothing useful'), null);
});

test('clearLocks removes only the two lock files and nothing else', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'locks-'));
  for (const f of ['.staging.lock', '.kb-sync.lock', 'keep.txt', 'other.lock']) fs.writeFileSync(path.join(dir, f), 'x');
  const removed = clearLocks([dir, path.join(dir, 'missing')]);
  assert.equal(removed.length, 2);
  assert.deepEqual(fs.readdirSync(dir).sort(), ['keep.txt', 'other.lock']);
  fs.rmSync(dir, { recursive: true });
});

test('retryArgs per runner', () => {
  assert.deepEqual(retryArgs('node'), ['--test-timeout=10000']);
  assert.ok(retryArgs('jest').includes('--detectOpenHandles'));
  assert.ok(!retryArgs('vitest').includes('--detectOpenHandles'));
});
