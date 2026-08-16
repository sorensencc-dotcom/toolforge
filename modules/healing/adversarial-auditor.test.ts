import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  runAdversarialCrossAudit,
  type AuditPacket,
  type LocalProviderLike
} from './adversarial-auditor.ts';

describe('AdversarialAuditor', () => {
  const samplePacket: AuditPacket = {
    packetId: 'pkt-test-001',
    specGoal: 'Implement deterministic transaction lock release',
    declaredScope: ['src/tx/lock.ts', 'src/tx/pool.ts'],
    testOutput: 'AssertionError: lock timeout did not fire after 500ms',
    appliedDiff: '--- a/src/tx/lock.ts\n+++ b/src/tx/lock.ts\n+setTimeout(resolve, 1000);',
    historyLog: [
      'Turn 1: Attempted direct timer increase',
      'Turn 2: Iron Gate failed on lock timeout'
    ]
  };

  it('correctly processes and parses raw JSON response from local provider', async () => {
    const mockProvider: LocalProviderLike = {
      generate: async (modelName, prompt) => {
        assert.equal(modelName, 'adversarial-auditor');
        assert.match(prompt, /pkt-test-001/);
        assert.match(prompt, /Implement deterministic transaction lock release/);
        return JSON.stringify({
          consensus: false,
          blockerAnalysis: 'Timer was increased to 1000ms exceeding 500ms assert window.',
          targetedFixRecipe: '1. Reduce lock timeout to 250ms.\n2. Ensure unlock hook resolves immediately on release.'
        });
      }
    };

    const verdict = await runAdversarialCrossAudit(samplePacket, mockProvider);

    assert.equal(verdict.consensus, false);
    assert.match(verdict.blockerAnalysis, /exceeding 500ms/);
    assert.match(verdict.targetedFixRecipe, /Reduce lock timeout/);
  });

  it('correctly parses markdown fenced json blocks from provider output', async () => {
    const mockProvider: LocalProviderLike = {
      generate: async () => {
        return '```json\n{\n  "consensus": true,\n  "blockerAnalysis": "None",\n  "targetedFixRecipe": "Proceed with merge"\n}\n```';
      }
    };

    const verdict = await runAdversarialCrossAudit(samplePacket, mockProvider);

    assert.equal(verdict.consensus, true);
    assert.equal(verdict.blockerAnalysis, 'None');
    assert.equal(verdict.targetedFixRecipe, 'Proceed with merge');
  });

  it('passes recent history log items into the audit prompt template', async () => {
    let capturedPrompt = '';
    const mockProvider: LocalProviderLike = {
      generate: async (_, prompt) => {
        capturedPrompt = prompt;
        return JSON.stringify({
          consensus: true,
          blockerAnalysis: 'Clean',
          targetedFixRecipe: 'None'
        });
      }
    };

    await runAdversarialCrossAudit(samplePacket, mockProvider);

    assert.match(capturedPrompt, /Turn 1: Attempted direct timer increase/);
    assert.match(capturedPrompt, /Turn 2: Iron Gate failed on lock timeout/);
    assert.match(capturedPrompt, /src\/tx\/lock\.ts/);
  });
});
