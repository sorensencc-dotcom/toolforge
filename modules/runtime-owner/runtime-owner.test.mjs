import test from 'node:test';
import assert from 'node:assert/strict';
import { validateEnvelope, transition } from './types.mjs';
import { spawnProcessGroup, signalGroup } from './process-groups.mjs';
import { sampleGroup, groupMembers, violation } from './limits.mjs';
import { cleanupOrphan } from './orphan-cleanup.mjs';
import { createEventLog } from './logs.mjs';
import { mkdtemp, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const envelope = { cpu_limit_percent: 100, memory_limit_mb: 128, max_concurrency: 1, timeout_seconds: 5, restart_policy: 'none', workflow_id: 'fixture' };
test('validates the Phase A envelope and legal transitions', () => { assert.equal(validateEnvelope('toolforge', envelope).owner, 'toolforge'); assert.equal(transition('created', 'running'), 'running'); assert.throws(() => transition('closed', 'running')); });
test('rejects restart policies and missing identity', () => { assert.throws(() => validateEnvelope('', envelope)); assert.throws(() => validateEnvelope('x', { ...envelope, restart_policy: 'on-failure' })); });
test('rejects illegal state transitions after closure', () => { assert.throws(() => transition('closed', 'running')); assert.throws(() => transition('violating', 'running')); });
test('rejects non-linux process ownership operations explicitly', async (t) => { if (process.platform === 'linux') return t.skip('Linux-only contract test'); const { createSupervisor } = await import('./index.mjs'); await assert.rejects(() => createSupervisor().createGroup('x', envelope), /Linux/); });

test('Linux process groups expose PGID, sample RSS, and terminate as a group', async (t) => {
  if (process.platform !== 'linux') return t.skip('Linux-only process-group test');
  const result = spawnProcessGroup(['sleep', '30'], {}, process.cwd());
  try { assert.equal(result.pid, result.pgid); const sample = await sampleGroup([result.pid]); assert.ok(sample.rssBytes > 0); assert.equal(signalGroup(result.pgid, 'SIGTERM'), true); } finally { signalGroup(result.pgid, 'SIGKILL'); }
});

test('Linux sampling aggregates a descendant in the same PGID', async (t) => {
  if (process.platform !== 'linux') return t.skip('Linux-only aggregate test');
  const result = spawnProcessGroup(['sh', '-c', 'sleep 30 & wait'], {}, process.cwd());
  try { await new Promise((resolve) => setTimeout(resolve, 100)); const members = await groupMembers(result.pgid); assert.ok(members.length >= 2); const sample = await sampleGroup(members); assert.ok(sample.rssBytes > 0); } finally { signalGroup(result.pgid, 'SIGKILL'); }
});

test('Linux stat parsing remains group-safe for named processes', async (t) => {
  if (process.platform !== 'linux') return t.skip('Linux-only stat parsing test');
  const result = spawnProcessGroup(['bash', '-c', 'exec -a "name with spaces" sleep 30'], {}, process.cwd());
  try { const members = await groupMembers(result.pgid); assert.ok(members.length >= 1); assert.ok((await sampleGroup(members)).cpuTicks >= 0); } finally { signalGroup(result.pgid, 'SIGKILL'); }
});

test('Linux resource thresholds use RSS and CPU samples', (t) => {
  if (process.platform !== 'linux') return t.skip('Linux-only resource test');
  assert.equal(violation({ rssBytes: 129 * 1024 * 1024, cpuPercent: 0 }, envelope), true);
  assert.equal(violation({ rssBytes: 0, cpuPercent: 101 }, envelope), true);
  assert.equal(violation({ rssBytes: 1, cpuPercent: 1 }, envelope), false);
});

test('Linux orphan cleanup only kills the recorded owned PGID', async (t) => {
  if (process.platform !== 'linux') return t.skip('Linux-only orphan test');
  const result = spawnProcessGroup(['sleep', '30'], {}, process.cwd());
  const dir = await mkdtemp(join(tmpdir(), 'runtime-owner-test-')); const path = join(dir, 'state.json');
  await writeFile(path, JSON.stringify({ groupId: 'orphan-test', owner: 'test-owner', pgid: result.pgid, pids: [result.pid], state: 'running' }));
  const cleaned = await cleanupOrphan(path, 'test-owner'); assert.equal(cleaned.cleaned, true); await new Promise((resolve) => setTimeout(resolve, 50));
  await assert.rejects(() => readFile(path));
});

test('Linux supervisor monitors a group and closes it after timeout', async (t) => {
  if (process.platform !== 'linux') return t.skip('Linux-only supervisor test');
  const dir = await mkdtemp(join(tmpdir(), 'runtime-owner-supervisor-'));
  const { createSupervisor } = await import('./index.mjs');
  const supervisor = createSupervisor({ logPath: join(dir, 'events.jsonl'), stateDir: dir });
  const events = []; supervisor.onEvent((event) => events.push(event));
  const id = await supervisor.createGroup('test-owner', { ...envelope, timeout_seconds: 1 });
  const child = await supervisor.spawnInGroup(id, ['sleep', '30'], { PATH: process.env.PATH }, process.cwd());
  assert.equal(child.pid, child.pgid);
  await new Promise((resolve) => setTimeout(resolve, 3400));
  const status = await supervisor.getGroupStatus(id);
  assert.equal(status.state, 'closed'); assert.ok(events.some((event) => event.event_type === 'timeout')); assert.ok(events.some((event) => event.event_type === 'cleanup_completed'));
  assert.deepEqual(events.map((event) => event.seq), [...events.keys()].map((value) => value + 1));
});

test('Linux supervisor terminates a group that exceeds RSS limit', async (t) => {
  if (process.platform !== 'linux') return t.skip('Linux-only memory enforcement test');
  const dir = await mkdtemp(join(tmpdir(), 'runtime-owner-memory-')); const { createSupervisor } = await import('./index.mjs');
  const supervisor = createSupervisor({ logPath: join(dir, 'events.jsonl'), stateDir: dir }); const events = []; supervisor.onEvent((event) => events.push(event));
  const id = await supervisor.createGroup('test-owner', { ...envelope, memory_limit_mb: 1, timeout_seconds: 5 });
  await supervisor.spawnInGroup(id, ['node', '-e', 'const x=Buffer.alloc(64*1024*1024); setTimeout(()=>console.log(x.length),30000)'], { PATH: process.env.PATH }, process.cwd());
  await new Promise((resolve) => setTimeout(resolve, 3400)); const status = await supervisor.getGroupStatus(id);
  assert.equal(status.state, 'closed'); assert.ok(events.some((event) => event.event_type === 'resource_violation'));
});

test('Linux orphan recovery reloads durable PGID state after supervisor loss', async (t) => {
  if (process.platform !== 'linux') return t.skip('Linux-only crash-recovery test');
  const result = spawnProcessGroup(['sleep', '30'], {}, process.cwd()); const dir = await mkdtemp(join(tmpdir(), 'runtime-owner-recovery-')); const path = join(dir, 'state.json');
  await writeFile(path, JSON.stringify({ groupId: 'recovered', owner: 'recovery-owner', pgid: result.pgid, pids: [result.pid], state: 'running' }));
  const recovered = await cleanupOrphan(path, 'recovery-owner'); assert.equal(recovered.pgid, result.pgid); assert.equal(recovered.cleaned, true);
});

test('Linux supervisor terminates a CPU-bound group after dwell', async (t) => {
  if (process.platform !== 'linux') return t.skip('Linux-only CPU enforcement test');
  const dir = await mkdtemp(join(tmpdir(), 'runtime-owner-cpu-')); const { createSupervisor } = await import('./index.mjs'); const supervisor = createSupervisor({ logPath: join(dir, 'events.jsonl'), stateDir: dir }); const events = []; supervisor.onEvent((event) => events.push(event));
  const id = await supervisor.createGroup('test-owner', { ...envelope, cpu_limit_percent: 1, timeout_seconds: 5 });
  await supervisor.spawnInGroup(id, ['node', '-e', 'while(true){}'], { PATH: process.env.PATH }, process.cwd());
  await new Promise((resolve) => setTimeout(resolve, 3400)); assert.equal((await supervisor.getGroupStatus(id)).state, 'closed'); assert.ok(events.some((event) => event.event_type === 'resource_violation'));
});

test('event persistence failure remains visible through callback fallback', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'runtime-owner-log-')); const events = []; const log = createEventLog(dir, (event) => events.push(event)); const result = await log.emit({ group_id: 'log-failure', owner: 'test', workflow_id: 'fixture', event_type: 'group_created', state: 'created', pgid: null });
  assert.ok(result.error); assert.equal(events[0].event_type, 'cleanup_failed');
});
