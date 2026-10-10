import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { analyzeSlop, SLOP_PATTERNS } from '../scripts/no-ai-slop.mjs';
import { matchLocalSignature, runTinyFishTriage } from '../scripts/trm-tinyfish-triage.mjs';
import { runParallelEscalation } from '../scripts/trm-parallel-escalation.mjs';
import { canonicalizeJCS, redactSensitiveData, requestSigilGuardApproval } from '../scripts/trm-sigil-guard.mjs';

describe('trm-devops-triage Skill Pack Test Suite', () => {

  describe('no-ai-slop Quality Linter', () => {
    it('detects AI slop patterns and lists violations', () => {
      const dirtyContent = 'In conclusion, this paradigm shift will delve into the tapestry of modern software.';
      const result = analyzeSlop(dirtyContent, false);

      assert.equal(result.clean, false);
      assert.ok(result.violationsFound.length >= 3);
      assert.ok(result.violationsFound.some(v => v.includes('in conclusion')));
      assert.ok(result.violationsFound.some(v => v.includes('paradigm shift')));
      assert.ok(result.violationsFound.some(v => v.includes('delve')));
      assert.ok(result.violationsFound.some(v => v.includes('tapestry of')));
    });

    it('passes clean technical documentation with zero violations', () => {
      const cleanContent = 'Fix checkout step in GitHub Actions workflow to specify branch ref.';
      const result = analyzeSlop(cleanContent, false);

      assert.equal(result.clean, true);
      assert.deepEqual(result.violationsFound, []);
      assert.equal(result.sanitizedContent, cleanContent);
    });

    it('sanitizes AI slop content when autoFix is true', () => {
      const input = 'As an AI language model, we delve into the system to seamlessly update configs.';
      const result = analyzeSlop(input, true);

      assert.equal(result.clean, false);
      assert.ok(!result.sanitizedContent.includes('As an AI language model'));
      assert.ok(!result.sanitizedContent.includes('delve'));
      assert.ok(!result.sanitizedContent.includes('seamlessly'));
      assert.ok(result.sanitizedContent.includes('explore'));
      assert.ok(result.sanitizedContent.includes('directly'));
    });
  });

  describe('trm-tinyfish-triage (Tier-1)', () => {
    it('matches Git credential failure signature deterministically', () => {
      const log = 'fatal: could not read Username for https://github.com: No such device or address';
      const match = matchLocalSignature(log);

      assert.ok(match);
      assert.equal(match.status, 'resolved');
      assert.ok(match.confidence >= 0.95);
      assert.ok(match.remediation.includes('GITHUB_TOKEN'));
    });

    it('matches Git submodule checkout failure signature', () => {
      const log = 'fatal: No url found for submodule path external/lib in .gitmodules';
      const match = matchLocalSignature(log);

      assert.ok(match);
      assert.equal(match.status, 'resolved');
      assert.ok(match.confidence >= 0.95);
      assert.ok(match.remediation.includes('submodule'));
    });

    it('matches Node runner deprecation warning', () => {
      const log = 'Node.js 16 actions are deprecated. Please update the following actions to use Node.js 20';
      const match = matchLocalSignature(log);

      assert.ok(match);
      assert.equal(match.status, 'resolved');
      assert.ok(match.remediation.includes('Node 20'));
    });

    it('escalates unknown log signatures to Tier-2', async () => {
      const unknownLog = 'Internal unknown compiler error 0xDEADBEEF in vendor kernel';
      const result = await runTinyFishTriage({ logExtract: unknownLog });

      assert.equal(result.status, 'escalated');
      assert.ok(result.confidence < 0.5);
      assert.ok(result.remediation.includes('Tier-2'));
    });
  });

  describe('trm-parallel-escalation (Tier-2)', () => {
    it('synthesizes resolution plan with Basis citations', async () => {
      const result = await runParallelEscalation({
        logExtract: 'Complex peer dependency collision on webpack v5',
        triageContext: 'Tier-1 returned unknown signature'
      });

      assert.equal(result.status, 'resolved');
      assert.ok(result.citations.length > 0);
      assert.ok(result.citations[0].includes('basis.parallel.ai'));
      assert.ok(result.synthesizedRemediation.includes('Tier-2 Parallel Research Synthesis'));
    });
  });

  describe('trm-sigil-guard', () => {
    it('produces RFC 8785 lexicographically sorted JCS serialization', () => {
      const unsortedObj = { z: 1, a: 2, m: { y: 'test', b: 'nested' } };
      const canonical = canonicalizeJCS(unsortedObj);
      assert.equal(canonical, '{"a":2,"m":{"b":"nested","y":"test"},"z":1}');
    });

    it('redacts sensitive secrets and API tokens', () => {
      const raw = {
        apiKey: ['sk', 'test_key_1234567890abcdef'].join('-'),
        token: ['ghp', 'mock_token_12345678901234567890123456'].join('_'),
        endpoint: 'https://api.example.com'
      };
      const sanitized = redactSensitiveData(raw);

      assert.equal(sanitized.apiKey, '[REDACTED]');
      assert.equal(sanitized.token, '[REDACTED]');
      assert.equal(sanitized.endpoint, 'https://api.example.com');
    });

    it('generates biometric approval signature envelope', async () => {
      const approval = await requestSigilGuardApproval({
        candidatePatch: 'diff --git a/workflow.yml b/workflow.yml\n+ node-version: 20',
        targetFile: '.github/workflows/validator.yml'
      });

      assert.equal(approval.approved, true);
      assert.ok(approval.signature.startsWith('jcs_sig_'));
      assert.ok(!isNaN(Date.parse(approval.timestamp)));
    });
  });

  describe('Manifest v1.2.0 & Pipeline Integrity', () => {
    it('manifest registers all 6 skills with valid entrypoints', async () => {
      const fs = await import('node:fs/promises');
      const manifestPath = new URL('../manifest.json', import.meta.url);
      const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));

      assert.equal(manifest.version, '1.2.0');
      assert.equal(manifest.skills.length, 6);

      const skillIds = manifest.skills.map(s => s.id);
      assert.ok(skillIds.includes('last30days-skill'));
      assert.ok(skillIds.includes('langextract'));
      assert.ok(skillIds.includes('trm-sigil-guard'));
      assert.ok(skillIds.includes('no-ai-slop'));
    });

    it('trend-intelligence-sweep pipeline binds clean inputs without schema mismatch', async () => {
      const fs = await import('node:fs/promises');
      const pipelinePath = new URL('../pipelines/trend-intelligence-sweep.json', import.meta.url);
      const task = JSON.parse(await fs.readFile(pipelinePath, 'utf8'));

      assert.equal(task.taskId, 'task_trend_intelligence_sweep');
      const stages = task.pipeline.stages;
      assert.equal(stages.length, 4);

      // Verify ordering: Discovery -> Slop Sanitization -> Grounded Extraction -> Sigil Guard
      assert.equal(stages[0].skill, 'last30days-skill');
      assert.equal(stages[1].skill, 'no-ai-slop');
      assert.equal(stages[2].skill, 'langextract');
      assert.equal(stages[3].skill, 'trm-sigil-guard');

      // Verify stage 4 uses candidatePatch (not candidatePayload)
      assert.ok(stages[3].inputs.candidatePatch);
      assert.equal(stages[3].inputs.candidatePayload, undefined);

      // Verify threshold condition exists
      assert.ok(stages[3].condition.includes('groundingRate >= 0.80'));
    });
  });
});

