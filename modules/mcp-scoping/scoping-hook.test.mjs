import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DynamicToolScopingHook,
  L0_BUNDLE_ID,
  heuristicTokenCounter,
  denyAllStepUp,
  HARD_BUDGET_TOKENS,
} from './scoping-hook.mjs';

const tool = (name, over = {}) => ({
  name,
  description: `tool ${name}`,
  side_effect: 'READ_ONLY',
  risk_tier: 'LOW',
  input_schema: { type: 'object' },
  ...over,
});
const bundle = (id, tools, over = {}) => ({
  bundle_id: id,
  domain: 'test',
  description: `bundle ${id}`,
  tools,
  allowed_roles: ['coder'],
  requires_step_up: false,
  max_mounted_ttl_ms: null,
  ...over,
});

function setup(over = {}) {
  const wal = [];
  let now = 0;
  const deps = {
    stepUp: { verify: async (_c, ev) => ev === 'good' },
    wal: { append: async (e) => void wal.push(e) },
    tokens: heuristicTokenCounter,
    clock: { now: () => now },
    hashAction: (t, a) => `h:${t}:${JSON.stringify(a)}`,
    roleBundles: { coder: 'bundle:inspect' },
    ...over,
  };
  const hook = new DynamicToolScopingHook(deps);
  hook.registerBundle(bundle('bundle:inspect', [tool('read_file')]));
  hook.registerBundle(bundle('bundle:mutate', [tool('write_file', { side_effect: 'MUTATING' })], { requires_step_up: true }));
  hook.registerBundle(bundle('bundle:rooms', [tool('post_message')], { allowed_roles: ['reviewer'] }));
  return { hook, wal, tick: (ms) => void (now += ms) };
}
const span = (id, role = 'coder', extra = {}) => ({
  session_id: 's1', trace_id: 't1', span_id: id, actor_role: role, grants: ['cap.write'], ...extra,
});

test('blocker 2: L0 discovery tools are mounted at span start, with or without a role bundle', async () => {
  const { hook } = setup();
  await hook.startSpan(span('a', 'coder'));
  await hook.startSpan(span('b', 'nobody'));
  for (const id of ['a', 'b']) {
    const names = hook.getActiveTools(id).map((t) => t.name);
    for (const n of ['toolforge_discover_bundles', 'toolforge_mount_bundle', 'toolforge_dismount_bundle']) {
      assert.ok(names.includes(n), `${id} missing ${n}`);
    }
  }
  assert.ok(hook.getActiveTools('a').some((t) => t.name === 'read_file'));
});

test('blocker 1: step-up fails closed on a forged prefix token and with the default deny verifier', async () => {
  const { hook } = setup();
  await hook.startSpan(span('a'));
  const forged = await hook.mount('a', 'bundle:mutate', 'sigil_stepup_auth_anything');
  assert.deepEqual(forged, { ok: false, error: 'STEP_UP_REQUIRED' });
  const none = setup({ stepUp: denyAllStepUp });
  await none.hook.startSpan(span('a'));
  assert.deepEqual(await none.hook.mount('a', 'bundle:mutate', 'good'), { ok: false, error: 'STEP_UP_REQUIRED' });
  assert.equal((await hook.mount('a', 'bundle:mutate', 'good')).ok, true);
});

test('blocker 3: invoke rejects unmounted tools, checks capability, writes intent before effect', async () => {
  const { hook, wal } = setup();
  await hook.startSpan(span('a'));
  assert.deepEqual(await hook.invoke('a', 'write_file', {}, async () => 1), { ok: false, error: 'TOOL_NOT_MOUNTED' });
  await hook.mount('a', 'bundle:mutate', 'good');
  const order = [];
  const r = await hook.invoke('a', 'write_file', { p: 1 }, async () => {
    order.push(`effect after ${wal.map((e) => e.phase).join(',')}`);
    return 'done';
  });
  assert.equal(r.ok, true);
  assert.equal(order[0], 'effect after SCOPE_CHANGE,SCOPE_CHANGE,INTENT'); // role-bundle mount, step-up mount, then intent
  assert.deepEqual(wal.slice(-2).map((e) => e.phase), ['INTENT', 'OUTCOME']);
  assert.equal(wal.at(-1) .action_hash, 'h:write_file:{"p":1}');
});

test('blocker 3: failed WAL append blocks a mutating call before it runs', async () => {
  const { hook } = setup({ wal: { append: async (e) => { if (e.phase === 'INTENT') throw new Error('down'); } } });
  await hook.startSpan(span('a'));
  await hook.mount('a', 'bundle:mutate', 'good');
  let ran = false;
  const r = await hook.invoke('a', 'write_file', {}, async () => void (ran = true));
  assert.deepEqual(r, { ok: false, error: 'WAL_APPEND_FAILED' });
  assert.equal(ran, false);
});

test('blocker 3: required_capability is enforced; TTL evicts a bundle', async () => {
  const { hook, tick } = setup();
  hook.registerBundle(bundle('bundle:capped', [tool('cap_tool', { required_capability: 'cap.missing' })]));
  hook.registerBundle(bundle('bundle:ttl', [tool('ttl_tool')], { max_mounted_ttl_ms: 1000 }));
  await hook.startSpan(span('a'));
  await hook.mount('a', 'bundle:capped');
  assert.deepEqual(await hook.invoke('a', 'cap_tool', {}, async () => 1), { ok: false, error: 'CAPABILITY_MISSING' });
  await hook.mount('a', 'bundle:ttl');
  tick(1001);
  assert.deepEqual(await hook.invoke('a', 'ttl_tool', {}, async () => 1), { ok: false, error: 'TOOL_NOT_MOUNTED' });
});

test('blocker 4: registration rejects a MUTATING tool in a bundle without step-up, and a missing flag', () => {
  const { hook } = setup();
  assert.throws(() => hook.registerBundle(bundle('bundle:bad', [tool('w', { side_effect: 'MUTATING' })])));
  assert.throws(() => hook.registerBundle(bundle('bundle:bad2', [tool('h', { risk_tier: 'HIGH' })])));
  const { requires_step_up: _drop, ...noFlag } = bundle('bundle:bad3', [tool('x')]);
  assert.throws(() => hook.registerBundle(noFlag));
});

test('blocker 5: role allowlist blocks mounting and hides bundles from discovery', async () => {
  const { hook } = setup();
  await hook.startSpan(span('r', 'researcher'));
  assert.deepEqual(await hook.mount('r', 'bundle:rooms'), { ok: false, error: 'BUNDLE_NOT_PERMITTED' });
  const d = hook.discover('r', 'bundle');
  assert.ok(d.ok && !d.bundles.some((b) => b.bundle_id === 'bundle:rooms'));
});

test('blocker 6: child span ceiling is a subset of the parent; contexts are keyed by span, not session', async () => {
  const { hook } = setup();
  hook.registerBundle(bundle('bundle:both', [tool('b_tool')], { allowed_roles: ['coder', 'reviewer'] }));
  await hook.startSpan(span('root', 'coder'));
  hook.registerBundle(bundle('bundle:late', [tool('late_tool')], { allowed_roles: ['reviewer'] }));
  await hook.startSpan(span('child', 'reviewer', { parent_span_id: 'root' }));
  // parent (coder) cannot mount rooms; child (reviewer) inherits that limit even though its role allows it
  assert.deepEqual(await hook.mount('child', 'bundle:rooms'), { ok: false, error: 'BUNDLE_NOT_PERMITTED' });
  // same session id, separate spans: parent still has its own tools
  assert.ok(hook.getActiveTools('root').some((t) => t.name === 'read_file'));
});

test('blocker 6: a child grants are the intersection with its parent grants', async () => {
  const { hook } = setup();
  hook.registerBundle(bundle('bundle:gc', [tool('gc_tool', { required_capability: 'cap.extra' })]));
  await hook.startSpan(span('root', 'coder'));
  await hook.startSpan(span('kid', 'coder', { parent_span_id: 'root', grants: ['cap.write', 'cap.extra'] }));
  await hook.mount('kid', 'bundle:gc');
  assert.deepEqual(await hook.invoke('kid', 'gc_tool', {}, async () => 1), { ok: false, error: 'CAPABILITY_MISSING' });
});

test('step-up approval on a parent is not inherited by a child span', async () => {
  const { hook } = setup();
  await hook.startSpan(span('root'));
  await hook.mount('root', 'bundle:mutate', 'good');
  await hook.startSpan(span('kid', 'coder', { parent_span_id: 'root' }));
  assert.ok(!hook.getActiveTools('kid').some((t) => t.name === 'write_file'));
});

test('endSpan cascades to children and frees state', async () => {
  const { hook } = setup();
  await hook.startSpan(span('root'));
  await hook.startSpan(span('kid', 'coder', { parent_span_id: 'root' }));
  await hook.endSpan('root');
  assert.deepEqual(hook.getActiveTools('root'), []);
  assert.deepEqual(hook.getActiveTools('kid'), []);
  assert.equal(hook.snapshot('kid'), undefined);
});

test('duplicate tool names across bundles are rejected', () => {
  const { hook } = setup();
  assert.throws(() => hook.registerBundle(bundle('bundle:dup', [tool('read_file')])), /DUPLICATE_TOOL/);
});

test('hard budget rejects a mount that would exceed it', async () => {
  const big = 'x'.repeat(HARD_BUDGET_TOKENS * 4);
  const { hook } = setup();
  hook.registerBundle(bundle('bundle:big', [tool('big_tool', { description: big })]));
  await hook.startSpan(span('a'));
  assert.deepEqual(await hook.mount('a', 'bundle:big'), { ok: false, error: 'SCHEMA_BUDGET_EXCEEDED' });
});

test('churn breaker: more than 6 mount/dismount ops in 3 turns without a functional call halts the span', async () => {
  const { hook } = setup();
  hook.registerBundle(bundle('bundle:extra', [tool('extra_tool')]));
  await hook.startSpan(span('a'));
  hook.beginTurn('a');
  const results = [];
  for (let i = 0; i < 4; i++) {
    results.push(await hook.mount('a', 'bundle:extra'));
    results.push(await hook.dismount('a', 'bundle:extra'));
  }
  const trip = results.findIndex((r) => !r.ok);
  assert.equal(trip, 6); // six ops are allowed; the seventh halts the span
  assert.deepEqual(results[trip], { ok: false, error: 'CIRCUIT_BREAKER_TOOL_CHURN' });
  assert.deepEqual(await hook.invoke('a', 'read_file', {}, async () => 1), { ok: false, error: 'SPAN_HALTED' });
});

test('a functional tool call resets the churn window', async () => {
  const { hook } = setup();
  hook.registerBundle(bundle('bundle:extra', [tool('extra_tool')]));
  await hook.startSpan(span('a'));
  for (let round = 0; round < 3; round++) {
    hook.beginTurn('a');
    assert.equal((await hook.mount('a', 'bundle:extra')).ok, true);
    assert.equal((await hook.dismount('a', 'bundle:extra')).ok, true);
    assert.equal((await hook.invoke('a', 'read_file', {}, async () => 1)).ok, true);
  }
});

test('reclaimed tokens accumulate on dismount and span end', async () => {
  const { hook } = setup();
  await hook.startSpan(span('a'));
  await hook.mount('a', 'bundle:mutate', 'good');
  const d = await hook.dismount('a', 'bundle:mutate');
  assert.ok(d.ok && d.reclaimed_tokens > 0);
  assert.equal(hook.snapshot('a') .reclaimed_tokens_total, d.ok ? d.reclaimed_tokens : -1);
  assert.deepEqual(await hook.dismount('a', L0_BUNDLE_ID), { ok: false, error: 'BUNDLE_NOT_PERMITTED' });
});
