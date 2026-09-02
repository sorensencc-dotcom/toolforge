import assert from 'node:assert';

const BASE_URL = process.env.STAGING_URL || 'http://127.0.0.1:8089';
const AUTH_HEADERS = { 'x-user-id': 'staging-admin', 'Content-Type': 'application/json' };

async function runSmokeTests() {
  console.log(` === STAGING SMOKE TEST SUITE ===`);
  console.log(`Target Base URL: ${BASE_URL}\n`);


  console.log('1. Health Endpoint & Privacy Check.');
  const healthRes = await fetch(`${BASE_URL}/health/provider`);
  assert.strictEqual(healthRes.status, 200, '/health/provider must return 200');
  const healthBase = await healthRes.json();
  assert.strictEqual(healthBase.status, 'healthy');
  assert.strictEqual(healthBase.provider, 'OllamaProvider');
  assert.strictEqual(healthBase.endpoint, undefined, 'Must not expose internal URL');
  assert.strictEqual(healthBase.OLLAMA_BASE_URL, undefined);
  console.log('  [PASS] Health metadata compliant, no internal endpoint exposure.');


  console.log(' \n2. Authentication Boundary Check.');
  const unauthGen = await fetch(`${BASE_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'llama3.2', prompt: 'hello' }),
  });
  assert.strictEqual(unauthGen.status, 401, 'Unauthorized request must return 401');

  const unauthMod = await fetch(`${BASE_URL}/api/models`);
  assert.strictEqual(unauthMod.status, 401);
  console.log('  [PASS] 401 rejection enforced on unauthenticated requests.');


  console.log(' \n3. Models Listing & Ollama Cluster Reachability.');
  const modelsRes = await fetch(`${BASE_URL}/api/models`, {
    headers: AUTH_HEADERS,
  });
  assert.strictEqual(modelsRes.status, 200);
  const modelsData = await modelsRes.json();
  const hasLlama = Array.isArray(modelsData.models) && modelsData.models.some(m => m.name.includes('llama3.2'));
  assert.ok(hasLlama, 'Staging cluster must have llama3.2 loaded');
  console.log('  [PASS] Ollama service reachable from API, llama3.2 available.');


  console.log(' \n4. Authenticated Generation (llama3.2) & Prompt Privacy.');
  const startTs = Date.now();
  const genRes = await fetch(`${BASE_URL}/api/generate`, {
    method: 'POST',
    headers: AUTH_HEADERS,
    body: JSON.stringify({
      model: 'llama3.2',
      prompt: 'Hi, please reply with exactly the word \"CONFIRMED\" and nothing else.',
    }),
  });
  const duration = Date.now() - startTs;
  assert.strictEqual(genRes.status, 200, 'Generation must succeed with 200');
  const genData = await genRes.json();
  assert.strictEqual(genData.success, true);
  assert.strictEqual(genData.model, 'llama3.2');
  assert.ok(typeof genData.result === 'string' && genData.result.length > 0, 'Must return non-empty result');
  assert.strictEqual(genData.prompt, undefined, 'Prompt MUST NOT be echo-returned for privacy');
  console.log(`  [PASS] Generation succeeded (${duration}ms). Prompt excluded from response envelope.`);


  console.log(' \n~5. Oversized Prompt Regulation (32KB Ceiling).');
  const hugePrompt = 'a'.repeat(35000);
  const limitRes = await fetch(`${BASE_URL}/api/generate`, {
    method: 'POST',
    headers: AUTH_HEADERS,
    body: JSON.stringify({ model: 'llama3.2', prompt: hugePrompt }),
  });
  assert.strictEqual(limitRes.status, 413, 'Oversized prompt must return 413');
  console.log('  [PASS] 413 enforced for prompts exceeding 32 KB.');


  console.log(' \n6. Fail-Closed Adversarial Audit Verification.');
  const auditRes = await fetch(`${BASE_URL}/api/audit`, {
    method: 'POST',
    headers: AUTH_HEADERS,
    body: JSON.stringify({
      packetId: 'pkt-staging-001',
      specGoal: 'Implement secure provider wiring',
      declaredScope: ['src/api/server.js'],
      testOutput: 'AssertionError: breaking change',
      appliedDiff: '- secure\n+ broken',
      historyLog: ['Turn 1: Staging verification'],
    }),
  });
  assert.strictEqual(auditRes.status, 200);
  const auditData = await auditRes.json();
  assert.strictEqual(typeof auditData.verdict.consensus, 'boolean', 'Audit verdict must contain boolean consensus');
  assert.strictEqual(typeof auditData.verdict.blockerAnalysis, 'string');
  assert.strictEqual(typeof auditData.verdict.targetedFixRecipe, 'string');
  console.log(`  [PASS] Adversarial audit parsed with fail-closed schema (consensus: ${auditData.verdict.consensus}).`);


  console.log('\nSuccess: All 6 Staging Smoke Tests PASSED.');
}

runSmokeTests().catch((err) => {
  console.error('\n[FAIL] Staging smoke test failed:', err);
  process.exit(1);
});
