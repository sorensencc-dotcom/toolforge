import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const workflow = readFileSync(new URL('../../../../.github/workflows/toolforge-wave-d.yml', import.meta.url), 'utf8');

function readinessCommand() {
  const step = workflow.match(/- name: Wait for Postgres to be ready\r?\n        run: \|\r?\n([\s\S]*?)(?=\r?\n      - name:)/);
  assert.ok(step, 'workflow must contain the Postgres readiness step');
  const command = step[1].match(/^          node ([^\r\n]*?) -e '\r?\n([\s\S]*?)\r?\n          '\s*$/);
  assert.ok(command, 'readiness step must invoke inline Node code');
  return [...command[1].trim().split(/\s+/), '-e', command[2]];
}

function runReadiness(failures) {
  // Execute the actual workflow command, replacing only TCP and retry timers.
  const preload = `
    import net from 'node:net';
    import { EventEmitter } from 'node:events';
    const calls = [];
    const delays = [];
    let ended = 0;
    net.createConnection = (port, host) => {
      calls.push({ port, host });
      const socket = new EventEmitter();
      socket.end = () => { ended += 1; };
      queueMicrotask(() => socket.emit(calls.length <= ${failures} ? 'error' : 'connect'));
      return socket;
    };
    globalThis.setTimeout = (callback, delay) => {
      delays.push(delay);
      queueMicrotask(callback);
    };
    process.on('exit', () => console.log(JSON.stringify({ calls, delays, ended })));
  `;
  const result = spawnSync(process.execPath, [
    '--import', `data:text/javascript,${encodeURIComponent(preload)}`,
    ...readinessCommand(),
  ], { encoding: 'utf8', timeout: 5_000 });
  assert.ifError(result.error);
  assert.equal(result.signal, null, result.stderr);
  return { ...result, trace: JSON.parse(result.stdout.trim()) };
}

test('Wave D readiness executes ESM and connects to Postgres over IPv4', () => {
  const result = runReadiness(0);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.trace, {
    calls: [{ port: 5432, host: '127.0.0.1' }], delays: [], ended: 1,
  });
});

test('Wave D readiness retries failed connections before succeeding', () => {
  const result = runReadiness(2);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.trace.calls, Array(3).fill({ port: 5432, host: '127.0.0.1' }));
  assert.deepEqual(result.trace.delays, [1500, 1500]);
  assert.equal(result.trace.ended, 1);
});

test('Wave D readiness fails after exhausting its bounded retries', () => {
  const result = runReadiness(21);
  assert.equal(result.status, 1, result.stderr);
  assert.deepEqual(result.trace.calls, Array(21).fill({ port: 5432, host: '127.0.0.1' }));
  assert.deepEqual(result.trace.delays, Array(20).fill(1500));
  assert.equal(result.trace.ended, 0);
});
