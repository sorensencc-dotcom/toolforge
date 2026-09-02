/**
 * Weekly Sweep Runner for CIC-WHICHLLM Upgrade Flow
 */
import { ProposalManager } from './proposal-manager.js';

export class SweepRunner {
  #proposalManager;

  constructor(opts = {}) {
    this.#proposalManager = opts.proposalManager ?? new ProposalManager();
  }

  async runSweep(installedModels = null) {
    const existingProposals = this.#proposalManager.listProposals();
    const approvedMap = new Map();
    const pendingMap = new Map();

    for (const p of existingProposals) {
      if (p.status === 'approved') {
        approvedMap.set(p.model, p.recommendedQuant);
      } else if (p.status === 'pending_approval') {
        pendingMap.set(`${p.model}:${p.recommendedQuant}`, p);
      }
    }

    const rawInventory = installedModels ?? [
      { model: 'qwen2.5-7b-instruct', currentQuant: 'q4_k_m', installedVramMb: 5200 },
      { model: 'llama-3.1-8b-instruct', currentQuant: 'q4_k_m', installedVramMb: 5800 },
      { model: 'phi-3.5-mini-instruct', currentQuant: 'q4_k_m', installedVramMb: 2900 },
    ];

    const inventory = rawInventory.map((m) => ({
      ...m,
      currentQuant: approvedMap.get(m.model) ?? m.currentQuant,
    }));

    const upstreamCandidates = [
      {
        model: 'qwen2.5-7b-instruct',
        recommendedQuant: 'q6_k',
        reason: '+12% benchmark score with identical VRAM fit',
        provenance: 'trusted',
      },
      {
        model: 'llama-3.1-8b-instruct',
        recommendedQuant: 'q5_k_m',
        reason: 'Improved reasoning perplexity at minimal compute overhead',
        provenance: 'trusted',
      },
    ];

    const generatedProposals = [];
    for (const candidate of upstreamCandidates) {
      const match = inventory.find((m) => m.model === candidate.model);
      if (match && match.currentQuant !== candidate.recommendedQuant) {
        const key = `${candidate.model}:${candidate.recommendedQuant}`;
        const existing = pendingMap.get(key);
        if (existing) {
          generatedProposals.push(existing);
        } else {
          const prop = this.#proposalManager.createProposal({
            ...candidate,
            currentQuant: match.currentQuant,
          });
          generatedProposals.push(prop);
        }
      }
    }

    return {
      sweepTimestamp: new Date().toISOString(),
      modelsScanned: inventory.length,
      proposalsGenerated: generatedProposals,
    };
  }

  formatBriefingSection(sweepResult) {
    if (sweepResult.proposalsGenerated.length === 0) {
      return '### Model Upgrade Opportunities (CIC-WHICHLLM)\nNo upgrade candidates pending review.';
    }

    let out = '### Model Upgrade Opportunities (CIC-WHICHLLM)\n\n';
    for (const p of sweepResult.proposalsGenerated) {
      out += `• **${p.model}**: ${p.currentQuant} → ${p.recommendedQuant}\n`;
      out += `  - **Reason:** ${p.reason}\n`;
      out += `  - **Provenance:** ${p.provenance}\n`;
      out += `  - **Proposal ID:** \`${p.proposalId}\`\n\n`;
    }
    return out.trim();
  }
}
