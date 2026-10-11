import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  REVERSIBILITY,
  classifyActionReversibility,
  registerToolReversibility,
  getToolReversibility,
  generateConfirmationToken,
  verifyConfirmationToken,
  OneWayDoorInterceptor,
  formatGatingPrompt
} from '../modules/OneWayDoorActionGate.mjs';

test('Taxonomy - defines canonical REVERSIBILITY enum', () => {
  assert.equal(REVERSIBILITY.REVERSIBLE, 'REVERSIBLE');
  assert.equal(REVERSIBILITY.IRREVERSIBLE, 'IRREVERSIBLE');
  assert.equal(REVERSIBILITY.BOUNDED, 'BOUNDED');
});

test('Taxonomy - standard tool default classifications', () => {
  // Reversible operations (Two-Way Doors)
  assert.equal(getToolReversibility('read_file'), REVERSIBILITY.REVERSIBLE);
  assert.equal(getToolReversibility('list_files'), REVERSIBILITY.REVERSIBLE);
  assert.equal(getToolReversibility('search_code'), REVERSIBILITY.REVERSIBLE);
  assert.equal(getToolReversibility('git_status'), REVERSIBILITY.REVERSIBLE);
  assert.equal(getToolReversibility('git_diff'), REVERSIBILITY.REVERSIBLE);

  // Bounded operations
  assert.equal(getToolReversibility('write_scratch'), REVERSIBILITY.BOUNDED);
  assert.equal(getToolReversibility('run_sandboxed_test'), REVERSIBILITY.BOUNDED);

  // Irreversible operations (One-Way Doors)
  assert.equal(getToolReversibility('delete_file'), REVERSIBILITY.IRREVERSIBLE);
  assert.equal(getToolReversibility('git_push'), REVERSIBILITY.IRREVERSIBLE);
  assert.equal(getToolReversibility('publish_package'), REVERSIBILITY.IRREVERSIBLE);
  assert.equal(getToolReversibility('send_message'), REVERSIBILITY.IRREVERSIBLE);
  assert.equal(getToolReversibility('execute_financial_transaction'), REVERSIBILITY.IRREVERSIBLE);
});

test('Taxonomy - custom tool registration and validation', () => {
  registerToolReversibility('custom_safe_query', REVERSIBILITY.REVERSIBLE);
  assert.equal(getToolReversibility('custom_safe_query'), REVERSIBILITY.REVERSIBLE);

  registerToolReversibility('custom_nuke_db', REVERSIBILITY.IRREVERSIBLE);
  assert.equal(getToolReversibility('custom_nuke_db'), REVERSIBILITY.IRREVERSIBLE);

  assert.throws(() => {
    registerToolReversibility('bad_tool', 'INVALID_TAG');
  }, /Invalid reversibility tag/);
});

test('Taxonomy - dynamic classification inference based on action verbs', () => {
  assert.equal(classifyActionReversibility({ toolName: 'fetch_remote_meta' }), REVERSIBILITY.REVERSIBLE);
  assert.equal(classifyActionReversibility({ toolName: 'drop_database_table' }), REVERSIBILITY.IRREVERSIBLE);
  assert.equal(classifyActionReversibility({ toolName: 'purge_s3_bucket' }), REVERSIBILITY.IRREVERSIBLE);
  assert.equal(classifyActionReversibility({ toolName: 'write_temp_cache' }), REVERSIBILITY.BOUNDED);
});

test('Interceptor - allows REVERSIBLE operations autonomously without gates', async () => {
  const interceptor = new OneWayDoorInterceptor();
  const result = await interceptor.intercept({
    toolName: 'read_file',
    params: { path: 'src/index.js' }
  });

  assert.equal(result.status, 'ALLOWED');
  assert.equal(result.reversibility, REVERSIBILITY.REVERSIBLE);
  assert.equal(result.confirmationRequired, false);
});

test('Interceptor - blocks unconfirmed IRREVERSIBLE actions (One-Way Door)', async () => {
  const interceptor = new OneWayDoorInterceptor();
  const result = await interceptor.intercept({
    toolName: 'delete_file',
    params: { path: 'critical/config.json' }
  });

  assert.equal(result.status, 'BLOCKED_BY_GATE');
  assert.equal(result.reversibility, REVERSIBILITY.IRREVERSIBLE);
  assert.equal(result.confirmationRequired, true);
  assert.ok(result.gateId, 'Gate ID should be present');
  assert.equal(result.riskClassification, 'CRITICAL');
  assert.ok(result.reason.includes('Irreversible action blocked'));
});

test('Interceptor - permits IRREVERSIBLE action when valid confirmation token is provided', async () => {
  const secretKey = 'test-secret-salt';
  const interceptor = new OneWayDoorInterceptor({ secretKey });

  // 1. Initial attempt gets blocked and returns gateId
  const blocked = await interceptor.intercept({
    toolName: 'git_push',
    params: { remote: 'origin', branch: 'main' }
  });
  assert.equal(blocked.status, 'BLOCKED_BY_GATE');
  const { gateId } = blocked;

  // 2. Generate confirmation token for this gate
  const confirmationToken = generateConfirmationToken(gateId, secretKey);

  // 3. Retry with confirmation token
  const allowed = await interceptor.intercept({
    toolName: 'git_push',
    params: { remote: 'origin', branch: 'main' },
    confirmationToken
  });

  assert.equal(allowed.status, 'ALLOWED');
  assert.equal(allowed.reversibility, REVERSIBILITY.IRREVERSIBLE);
  assert.equal(allowed.confirmed, true);
  assert.equal(allowed.tokenVerified, true);
});

test('Interceptor - rejects tampered or mismatched confirmation tokens', async () => {
  const secretKey = 'test-secret-salt';
  const interceptor = new OneWayDoorInterceptor({ secretKey });

  const result = await interceptor.intercept({
    toolName: 'publish_package',
    params: { name: 'toolforge-core' },
    confirmationToken: 'forged-or-expired-token'
  });

  assert.equal(result.status, 'BLOCKED_BY_GATE');
  assert.equal(result.error, 'INVALID_CONFIRMATION_TOKEN');
});

test('Interceptor - enforces boundaries on BOUNDED tools', async () => {
  const interceptor = new OneWayDoorInterceptor();

  // Valid bounded write within scratch
  const validBounded = await interceptor.intercept({
    toolName: 'write_scratch',
    params: { path: 'scratch/temp-plan.json', content: '{}' }
  });
  assert.equal(validBounded.status, 'ALLOWED');
  assert.equal(validBounded.reversibility, REVERSIBILITY.BOUNDED);

  // Breach bounded limit: write to sensitive production file
  const breached = await interceptor.intercept({
    toolName: 'write_scratch',
    params: { path: 'src/api/server.js', content: 'hacked' }
  });
  assert.equal(breached.status, 'BLOCKED_BY_GATE');
  assert.equal(breached.reversibility, REVERSIBILITY.BOUNDED);
  assert.equal(breached.breach, 'BOUNDARY_EXCEEDED');
});

test('Interceptor - triggers HARD_PAUSE on dynamic plan drift', async () => {
  const interceptor = new OneWayDoorInterceptor();

  // Plan declared as REVERSIBLE_ONLY
  const planSession = {
    planId: 'plan-refactor-login',
    declaredMode: 'REVERSIBLE_ONLY'
  };

  // Step 1: Safe read passes
  const step1 = await interceptor.intercept({
    toolName: 'read_file',
    params: { path: 'src/login.js' },
    planContext: planSession
  });
  assert.equal(step1.status, 'ALLOWED');

  // Step 2: Agent drifts into irreversible deletion without updating charter
  const step2 = await interceptor.intercept({
    toolName: 'delete_file',
    params: { path: 'src/legacy-login.js' },
    planContext: planSession
  });

  assert.equal(step2.status, 'HARD_PAUSE');
  assert.equal(step2.error, 'PLAN_DRIFT_DETECTED');
  assert.equal(step2.driftedAction, 'delete_file');
  assert.ok(step2.reason.includes('Reversible-only plan attempted fallback or drift'));
});

test('CLI - formatGatingPrompt renders structured risk prompt', () => {
  const gateInfo = {
    gateId: 'gate-abc-123',
    toolName: 'delete_file',
    params: { path: 'data/records.db' },
    riskClassification: 'CRITICAL',
    reversibility: REVERSIBILITY.IRREVERSIBLE,
    diffSummary: 'Deletes persistent database file data/records.db'
  };

  const formatted = formatGatingPrompt(gateInfo);
  assert.ok(formatted.includes('ONE-WAY DOOR EXECUTION GATE'));
  assert.ok(formatted.includes('delete_file'));
  assert.ok(formatted.includes('CRITICAL'));
  assert.ok(formatted.includes('gate-abc-123'));
  assert.ok(formatted.includes('Deletes persistent database file'));
});

test('Interceptor - hard stops unconfirmed external network transmissions', async () => {
  const interceptor = new OneWayDoorInterceptor();

  const networkAttempt = await interceptor.intercept({
    toolName: 'http_post_external',
    params: { url: 'https://api.external-sink.com/dispatch', payload: { secret: 'token' } }
  });

  assert.equal(networkAttempt.status, 'BLOCKED_BY_GATE');
  assert.equal(networkAttempt.reversibility, REVERSIBILITY.IRREVERSIBLE);
  assert.equal(networkAttempt.confirmationRequired, true);
  assert.ok(networkAttempt.gateId);
});

test('verifyConfirmationToken - safely rejects null, empty, or mismatched length tokens without throwing', () => {
  assert.equal(verifyConfirmationToken(null, 'gate-123'), false);
  assert.equal(verifyConfirmationToken('', 'gate-123'), false);
  assert.equal(verifyConfirmationToken('short', 'gate-123'), false);
  assert.equal(verifyConfirmationToken(12345, 'gate-123'), false);
});

test('Interceptor - computeGateId is invariant to object key ordering permutations', () => {
  const interceptor = new OneWayDoorInterceptor();
  const id1 = interceptor.computeGateId('delete_file', { path: 'a.txt', recursive: true, force: false });
  const id2 = interceptor.computeGateId('delete_file', { force: false, path: 'a.txt', recursive: true });
  assert.equal(id1, id2);
});

test('Interceptor - blocks directory traversal attempts escaping bounded scratchpad', async () => {
  const interceptor = new OneWayDoorInterceptor();
  const escapeAttempt = await interceptor.intercept({
    toolName: 'write_scratch',
    params: { path: 'scratch/../../src/core.js', content: 'malicious' }
  });
  assert.equal(escapeAttempt.status, 'BLOCKED_BY_GATE');
  assert.equal(escapeAttempt.breach, 'BOUNDARY_EXCEEDED');
  assert.ok(escapeAttempt.reason.includes('breaches bounded') || escapeAttempt.reason.includes('traversal'));
});

test('Interceptor - blocks Windows-style directory traversal escaping bounded scratchpad', async () => {
  const interceptor = new OneWayDoorInterceptor();
  const escapeAttempt = await interceptor.intercept({
    toolName: 'write_scratch',
    params: { path: 'scratch\\..\\..\\src\\core.js', content: 'malicious' }
  });
  assert.equal(escapeAttempt.status, 'BLOCKED_BY_GATE');
  assert.equal(escapeAttempt.breach, 'BOUNDARY_EXCEEDED');
  assert.ok(escapeAttempt.reason.includes('breaches bounded'));
});

test('Interceptor - blocks absolute path attempts escaping bounded scratchpad', async () => {
  const interceptor = new OneWayDoorInterceptor();

  const posixAbs = await interceptor.intercept({
    toolName: 'write_scratch',
    params: { path: '/etc/passwd', content: 'root' }
  });
  assert.equal(posixAbs.status, 'BLOCKED_BY_GATE');
  assert.equal(posixAbs.breach, 'BOUNDARY_EXCEEDED');

  const winAbs = await interceptor.intercept({
    toolName: 'write_scratch',
    params: { path: 'C:\\evil.js', content: 'malicious' }
  });
  assert.equal(winAbs.status, 'BLOCKED_BY_GATE');
  assert.equal(winAbs.breach, 'BOUNDARY_EXCEEDED');
});



