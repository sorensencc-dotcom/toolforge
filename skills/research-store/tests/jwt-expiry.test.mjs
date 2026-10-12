import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { createClient } from '@supabase/supabase-js';

const project = 'bhezixgmkhpndmezgsxk';
const root = fileURLToPath(new URL('../../../', import.meta.url));
const run = promisify(execFile);
const cli = async args => {
  try {
    const { stdout } = await run('C:\\Program Files\\Git\\bin\\bash.exe', ['-lc',
      `timeout 45s npx --yes supabase ${args}`], { cwd: root, timeout: 48000, maxBuffer: 1024 * 1024 });
    return JSON.parse(stdout);
  } catch { throw new Error('Dev/UAT CLI failed (details suppressed)'); }
};
const check = (result, phase) => {
  if (result.error) throw new Error(`Dev/UAT ${phase} failed (details suppressed)`);
  return result.data;
};

test('genuinely signed expired JWT is denied by real dev/UAT API and Auth config is restored', { timeout: 420000 }, async () => {
  assert.equal(process.env.RESEARCH_UAT_AUTH_EXPIRY_APPROVED, '1', 'explicit temporary dev/UAT Auth change approval required');
  assert.equal((await readFile(join(root, 'supabase/.temp/project-ref'), 'utf8')).trim(), project);
  const keys = (await cli(`projects api-keys --project-ref ${project} --reveal --output-format json`)).keys;
  const anon = keys.find(key => key.name === 'anon')?.api_key;
  const writer = keys.find(key => key.name === 'service_role')?.api_key;
  assert.ok(anon && writer, 'dev/UAT credentials unavailable');
  const url = `https://${project}.supabase.co`;
  const options = { auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(10000) }) } };
  const service = createClient(url, writer, options);
  const fixture = await mkdtemp(join(tmpdir(), 'research-jwt-expiry-'));
  await mkdir(join(fixture, 'supabase'));
  const configFile = join(fixture, 'supabase/config.toml');
  const config = expiry => writeFile(configFile, `project_id = "research-jwt-expiry"\n[auth]\njwt_expiry = ${expiry}\n`);
  const target = `--project-ref ${project} --workdir '${fixture.replaceAll('\\', '/')}' --output-format json`;
  const diff = () => cli(`config diff ${target}`);
  const push = () => cli(`config push ${target} --yes`);
  const declared = value => value.changes.filter(change => change.declared);
  const unrelated = value => value.changes.filter(change => change.path.join('.') !== 'auth.jwt_expiry');
  const settled = async () => {
    const deadline = Date.now() + 60000;
    do {
      const value = await diff();
      if (declared(value).length === 0) return value;
      assert.ok(declared(value).every(change => change.path.join('.') === 'auth.jwt_expiry'),
        'unexpected declared remote config change');
      console.log('Waiting for dev/UAT Auth expiry configuration to converge.');
      await delay(2000);
    } while (Date.now() < deadline);
    throw new Error('Dev/UAT Auth expiry configuration did not converge');
  };
  const raw = token => fetch(`${url}/rest/v1/documents?select=id,project&limit=1`, {
    headers: { apikey: anon, Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10000) });
  let userId;
  let originalExpiry;
  let restoreNeeded = false;
  let restored = false;
  let baseline;
  const restore = async () => {
    await config(originalExpiry);
    await push();
    const after = await settled();
    assert.equal(declared(after).length, 0, 'original Auth expiry was not restored');
    assert.deepEqual(unrelated(after), unrelated(baseline), 'unrelated remote configuration changed');
    restored = true;
    restoreNeeded = false;
    console.log(`Dev/UAT Auth expiry restored and verified: ${originalExpiry} seconds.`);
  };
  try {
    await config(60);
    baseline = await diff();
    const changes = declared(baseline);
    assert.equal(changes.length, 1, 'expected exactly one declared remote config change');
    assert.equal(changes[0].path.join('.'), 'auth.jwt_expiry');
    originalExpiry = changes[0].remote;
    assert.ok(Number.isInteger(originalExpiry) && originalExpiry > 60, 'safe original expiry unavailable');
    const email = `research-expiry-${randomUUID()}@example.com`;
    const password = randomUUID() + randomUUID();
    userId = check(await service.auth.admin.createUser({ email, password, email_confirm: true,
      app_metadata: { project: 'CIC' } }), 'create expiry identity').user.id;
    restoreNeeded = true;
    console.log(`Temporarily changing dev/UAT Auth expiry from ${originalExpiry} to 60 seconds.`);
    await push();
    await settled();
    const reader = createClient(url, anon, options);
    const session = check(await reader.auth.signInWithPassword({ email, password }), 'signed login').session;
    assert.ok(session?.access_token, 'signed token missing');
    const token = session.access_token;
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url'));
    assert.equal(payload.role, 'authenticated');
    assert.equal(payload.iss, `${url}/auth/v1`);
    assert.ok(Number.isFinite(payload.exp) && payload.exp - payload.iat <= 60 && payload.exp > Date.now() / 1000,
      'issuer did not mint a live short-lived token');
    const accepted = await raw(token);
    assert.equal(accepted.status, 200, 'unmodified issuer token must work before expiry');
    assert.ok((await accepted.json()).some(row => row.project === 'CIC'), 'positive control must retrieve authorized data');
    await restore();
    while (Date.now() < (payload.exp + 2) * 1000) {
      console.log('Waiting for unmodified signed token to expire; original Auth config already restored.');
      await delay(Math.min(30000, (payload.exp + 2) * 1000 - Date.now()));
    }
    let response;
    const deadline = (payload.exp + 40) * 1000;
    do {
      response = await raw(token);
      if (response.status === 401) break;
      assert.equal(response.status, 200, 'unexpected API failure cannot establish token expiry');
      await delay(2000);
    } while (Date.now() < deadline);
    assert.equal(response.status, 401, 'same genuinely signed token must deny after expiry');
    const denial = await response.json();
    assert.ok(/expired/i.test(denial.message ?? ''), 'denial must identify expiry, not invalid signature');
    console.log(`Real signed-expiry API denial passed: HTTP 401, ${denial.code}.`);
  } finally {
    const failures = [];
    if (restoreNeeded) {
      try { await restore(); }
      catch { failures.push('Auth restoration unverified; original expiry config retained in temporary fixture'); }
    }
    if (userId) {
      try {
        check(await service.auth.admin.deleteUser(userId), 'expiry identity cleanup');
        const gone = await service.auth.admin.getUserById(userId);
        assert.ok(gone.error && !gone.data?.user, 'run-owned expiry identity remains');
      } catch { failures.push('expiry identity cleanup unverified'); }
    }
    if (restoreNeeded) console.error(`Original Auth expiry restoration config: ${configFile}`);
    if (originalExpiry !== undefined && !restored) failures.push('Auth restoration unverified');
    assert.deepEqual(failures, [], 'JWT rehearsal recovery or cleanup failed');
    await rm(fixture, { recursive: true, force: true });
    console.log('Run-owned JWT identity and temporary config cleaned up.');
  }
});
