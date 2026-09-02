import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { SchemaMigrator, LineageReplayer, UpgradePlanner, ProposalManager, SweepRunner, ModelInstaller } from '../src/index.js';

describe('Upgrade Planner & Mode B Approval Flow', () => {
  it('generates a 5-step upgrade plan with rollback sequence', () => {
    const planner = new UpgradePlanner();
    const plan = planner.generatePlan('cic-whichllm-default-v1', '2.4.0', '2.5.0');
    assert.equal(plan.steps.length, 5);
    assert.equal(plan.rollbackSteps.length, 3);
    assert.equal(plan.sourceVersion, '2.4.0');
    assert.equal(plan.targetVersion, '2.5.0');
  });

  it('validates schema compatibility', () => {
    const c1 = SchemaMigrator.validateCompatibility('2.4.0', '2.4.0');
    assert.equal(c1.compatible, true);
    assert.equal(c1.breaking, false);
  });

  it('executes full proposal approval lifecycle with lineage stamping', async () => {
    const testDir = path.resolve('C:/dev/CIC-GOVERNANCE/packages/cic-whichllm-upgrade-planner/proposals/test-suite');
    const manager = new ProposalManager({ proposalsDir: testDir });

    const proposal = manager.createProposal({
      model: 'qwen2.5-7b-instruct',
      currentQuant: 'q4_k_m',
      recommendedQuant: 'q6_k',
      reason: '+12% benchmark score with identical VRAM fit',
    });

    assert.equal(proposal.status, 'pending_approval');
    assert.match(proposal.proposalId, /^prop-/);

    const { proposal: approved, lineageHash } = await manager.decideProposal(
      proposal.proposalId,
      'approved',
      'operator:sorensen',
      'Approved for production briefing'
    );

    assert.equal(approved.status, 'approved');
    assert.match(lineageHash, /^[0-9a-f]{64}$/);
    assert.equal(approved.decisionLog.decision, 'approved');

    // Cleanup test artifacts
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  it('runs weekly sweep and formats briefing markdown', async () => {
    const testDir = path.resolve('C:/dev/CIC-GOVERNANCE/packages/cic-whichllm-upgrade-planner/proposals/test-sweep');
    const manager = new ProposalManager({ proposalsDir: testDir });
    const runner = new SweepRunner({ proposalManager: manager });

    const result = await runner.runSweep();
    assert.equal(result.modelsScanned, 3);
    assert.equal(result.proposalsGenerated.length, 2);

    const briefing = runner.formatBriefingSection(result);
    assert.match(briefing, /Model Upgrade Opportunities/);
    assert.match(briefing, /qwen2.5-7b-instruct/);

    // Cleanup test sweep artifacts
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  it('derives clean Ollama tags correctly', () => {
    const installer = new ModelInstaller();
    assert.equal(installer.deriveOllamaTag('qwen2.5-7b-instruct', 'q6_k'), 'qwen2.5:7b');
    assert.equal(installer.deriveOllamaTag('llama-3.1-8b-instruct', 'q5_k_m'), 'llama3.1:8b');
    assert.equal(installer.deriveOllamaTag('phi-3.5-mini-instruct', 'q4_k_m'), 'phi3.5:latest');
  });
});
