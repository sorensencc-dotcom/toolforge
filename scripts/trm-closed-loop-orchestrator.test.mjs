import assert from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { runClosedLoopResearch } from './trm-closed-loop-orchestrator.mjs';

console.log('🧪 Starting End-to-End Test Suite for TRM Closed-Loop Orchestrator...');

const testSandbox = path.join(os.tmpdir(), `trm-e2e-sandbox-${Date.now()}`);
fs.mkdirSync(testSandbox, { recursive: true });

try {
  // Test 1: Full Dry-Run Execution
  console.log('▶ Test 1: Full Dry-Run Execution in Sandbox');
  const result = await runClosedLoopResearch({
    repoRoot: testSandbox,
    dryRun: true,
    notebookId: 'mock-nb-999'
  });

  assert.strictEqual(result.success, true, 'Orchestration should succeed');
  assert.ok(fs.existsSync(result.gapsFile), 'Gaps file must be generated');
  assert.strictEqual(result.resolvedMappings.length, 2, 'Should resolve 2 sources');
  assert.strictEqual(result.mentalModels.length, 3, 'Should generate 3 mental models');
  assert.ok(fs.existsSync(result.packPath), 'Consolidated pack must be created');

  // Verify pack contents
  const packContent = fs.readFileSync(result.packPath, 'utf8');
  assert.ok(packContent.includes('trm-research-gaps.md'), 'Pack must include gaps');
  assert.ok(packContent.includes('mobile-websocket-heartbeats.md'), 'Pack must include concept 1');
  assert.ok(packContent.includes('historical-revocation-verification.md'), 'Pack must include concept 2');
  assert.ok(packContent.includes('wiki/mental-models/trm-closed-loop-topology.md'), 'Pack must include mental models');

  // Verify why-evidence blocks in generated wiki files
  const concept1Path = path.join(testSandbox, 'wiki', 'research', 'mobile-websocket-heartbeats.md');
  const concept1Content = fs.readFileSync(concept1Path, 'utf8');
  assert.ok(concept1Content.includes('## WHY-EVIDENCE'), 'Concept 1 must include WHY-EVIDENCE block');
  assert.ok(concept1Content.includes('verification_status: contradiction_flagged'), 'Concept 1 must have contradiction status');

  console.log('  ✔ Passed');

  console.log('\n🟢 All TRM Orchestrator E2E tests passed successfully!');
} finally {
  fs.rmSync(testSandbox, { recursive: true, force: true });
}
