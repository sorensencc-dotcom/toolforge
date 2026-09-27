import assert from 'assert';
import { verifyTopicGaps, formatWhyEvidenceBlock } from './why-verifier.mjs';

console.log('🧪 Starting TDD Suite for why-verifier (Seams A & B)...');

// Fixture: Mock gap card markdown table with escaped pipes and various entry key types
const mockGapsContent = `
# Research Gaps: CIC - Test Fixture

| Question | Answer excerpt | Notebook | First-seen date | Entry key |
|---|---|---|---|---|
| What open questions exist? | Historical accounts dispute authority over B-24 tooling between Sorensen \\| military liaisons. | CIC - Test | 2026-09-25 | 6fd7c40b-df90-444b-9c7a-a64682925856:open-contradictions:e5144ad8dcdb4e76211ded103daaf055a1c6408d544ca64c8bafa6150df921eb |
| What claims are asserted but single-sourced? | Sole memoir account asserts executive purge occurred in 1943. | CIC - Test | 2026-09-25 | 6fd7c40b-df90-444b-9c7a-a64682925856:under-sourced:4791426f464ae6658e31880a75fa6e898ab30830d8ee36c53c4efa4f1b4370be |
| What adjacent topics exist? | Explores Willow Run runway expansion logistics. | CIC - Test | 2026-09-25 | 6fd7c40b-df90-444b-9c7a-a64682925856:adjacent-topics:61908dc4b6f64574a2943e5671767aa70e8e3fbcfac6ff450fd00980411802aa |
| What follow-up research is needed? | Archival search in Record Group 72. | CIC - Test | 2026-09-25 | 6fd7c40b-df90-444b-9c7a-a64682925856:follow-up:822bee4c8ffafcfea38571f877fe9a2eb311e4f11439d998bebb47701070ef69 |
`.trim();

// Test 1: Category Mode - open-contradictions
{
  console.log('▶ Test 1: Category Mode (open-contradictions)');
  const res = verifyTopicGaps('open-contradictions', { gapsContent: mockGapsContent });
  assert.strictEqual(res.verdict, 'GROUNDED', 'Verdict should be GROUNDED');
  assert.strictEqual(res.verificationStatus, 'contradiction_flagged', 'Status should be contradiction_flagged');
  assert.strictEqual(res.sources.length, 1, 'Should find 1 source');
  assert.ok(res.contradictions.length > 0, 'Should extract contradictions');
  console.log('  ✔ Passed');
}

// Test 2: Category Mode - under-sourced
{
  console.log('▶ Test 2: Category Mode (under-sourced)');
  const res = verifyTopicGaps('under-sourced', { gapsContent: mockGapsContent });
  assert.strictEqual(res.verdict, 'GROUNDED', 'Verdict should be GROUNDED');
  assert.strictEqual(res.verificationStatus, 'single-sourced', 'Status should be single-sourced');
  assert.strictEqual(res.sources[0].singleSourced, true, 'Source should be marked singleSourced');
  console.log('  ✔ Passed');
}

// Test 3: Topic / Keyword Mode - "Willow Run"
{
  console.log('▶ Test 3: Topic / Keyword Mode ("Willow Run")');
  const res = verifyTopicGaps('willow-run', { gapsContent: mockGapsContent });
  assert.strictEqual(res.verdict, 'GROUNDED', 'Verdict should be GROUNDED');
  assert.strictEqual(res.sources.length, 1, 'Should find matching row');
  console.log('  ✔ Passed');
}

// Test 4: Missing / Unknown Topic - NO-EVIDENCE
{
  console.log('▶ Test 4: Missing Topic (NO-EVIDENCE)');
  const res = verifyTopicGaps('non-existent-topic-xyz', { gapsContent: mockGapsContent });
  assert.strictEqual(res.verdict, 'NO-EVIDENCE', 'Verdict should be NO-EVIDENCE');
  assert.strictEqual(res.verificationStatus, 'unverified', 'Status should be unverified');
  assert.strictEqual(res.sources.length, 0, 'Should have 0 sources');
  console.log('  ✔ Passed');
}

// Test 5: Seam B - formatWhyEvidenceBlock Rendering
{
  console.log('▶ Test 5: formatWhyEvidenceBlock Rendering');
  const res = verifyTopicGaps('open-contradictions', { gapsContent: mockGapsContent });
  const block = formatWhyEvidenceBlock(res);
  assert.ok(block.includes('<details>'), 'Should include <details>');
  assert.ok(block.includes('## WHY-EVIDENCE'), 'Should include ## WHY-EVIDENCE heading');
  assert.ok(block.includes('verdict: GROUNDED'), 'Should include verdict: GROUNDED');
  assert.ok(!block.includes('\\'), 'Should not contain Windows backslashes');
  console.log('  ✔ Passed');
}

// Test 6: Live Vault - Notebook Slug Verification
{
  console.log('▶ Test 6: Live Vault - cic-willow-run-aviation-engineering');
  const res = verifyTopicGaps('cic-willow-run-aviation-engineering', { vaultPath: 'C:/Users/soren/trm-vault' });
  assert.strictEqual(res.verdict, 'GROUNDED', 'Live vault verdict should be GROUNDED');
  assert.ok(res.sources.length >= 1, 'Should find at least 1 source row in live vault');
  console.log('  ✔ Passed');
}

// Test 7: Live Vault - Category Verification Across Vault
{
  console.log('▶ Test 7: Live Vault - Category Mode (under-sourced)');
  const res = verifyTopicGaps('under-sourced', { vaultPath: 'C:/Users/soren/trm-vault' });
  assert.strictEqual(res.verdict, 'GROUNDED', 'Live vault category verdict should be GROUNDED');
  assert.ok(res.sources.length >= 2, 'Should find multiple sources across notebooks');
  assert.strictEqual(res.corroborated, true, 'Multi-file occurrences should be corroborated');
  console.log('  ✔ Passed');
}

console.log('\n🟢 All TDD tests passed successfully!');

