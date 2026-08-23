/**
 * Proposal Manager for CIC-WHICHLLM Upgrade Flow (Approval Mode)
 */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { LineageContract } from '../../cic-whichllm-integration-pack/src/lineage/lineage-contract.js';

export class ProposalManager {
  #proposalsDir;
  #harvesterId;

  constructor(opts = {}) {
    this.#proposalsDir = opts.proposalsDir ?? path.resolve('C:/dev/CIC-GOVERNANCE/packages/cic-whichllm-upgrade-planner/proposals');
    this.#harvesterId = opts.harvesterId ?? 'cic-whichllm-default-v1';
    fs.mkdirSync(this.#proposalsDir, { recursive: true });
  }

  createProposal(candidate) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const proposalId = `prop-${timestamp}-${createHash('sha256').update(candidate.model + candidate.recommendedQuant).digest('hex').slice(0, 8)}`;

    const proposal = {
      proposalId,
      model: candidate.model,
      currentQuant: candidate.currentQuant,
      recommendedQuant: candidate.recommendedQuant,
      reason: candidate.reason,
      provenance: candidate.provenance ?? 'trusted',
      status: 'pending_approval', // 'pending_approval' | 'approved' | 'rejected' | 'deferred'
      action: 'upgrade_available',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      decisionLog: null,
    };

    const filePath = path.join(this.#proposalsDir, `${proposalId}.json`);
    fs.writeFileSync(filePath, JSON.stringify(proposal, null, 2), 'utf8');
    return proposal;
  }

  getProposal(proposalId) {
    const filePath = path.join(this.#proposalsDir, `${proposalId}.json`);
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  }

  listProposals(statusFilter) {
    const files = fs.readdirSync(this.#proposalsDir).filter((f) => f.endsWith('.json'));
    const proposals = files.map((f) => JSON.parse(fs.readFileSync(path.join(this.#proposalsDir, f), 'utf8')));
    if (!statusFilter) return proposals;
    return proposals.filter((p) => p.status === statusFilter);
  }

  async decideProposal(proposalId, decision, actor = 'operator:sorensen', notes = '') {
    const proposal = this.getProposal(proposalId);
    if (!proposal) throw new Error(`Proposal ${proposalId} not found`);
    if (proposal.status !== 'pending_approval') {
      throw new Error(`Cannot decide proposal in state: ${proposal.status}`);
    }

    if (!['approved', 'rejected', 'deferred'].includes(decision)) {
      throw new Error(`Invalid decision: ${decision}. Must be 'approved', 'rejected', or 'deferred'`);
    }

    proposal.status = decision;
    proposal.updatedAt = new Date().toISOString();
    proposal.decisionLog = {
      decision,
      actor,
      timestamp: new Date().toISOString(),
      notes,
    };

    let lineageHash = null;
    if (decision === 'approved') {
      const lc = new LineageContract({ harvesterId: this.#harvesterId });
      lineageHash = await lc.stamp({
        queryId: `upg-${proposalId}`,
        requestHash: createHash('sha256').update(JSON.stringify(proposal), 'utf8').digest('hex'),
        responseHash: createHash('sha256').update(`approved:${proposal.model}:${proposal.recommendedQuant}`).digest('hex'),
        model: proposal.model,
      });
      proposal.lineageHash = lineageHash;
    }

    const filePath = path.join(this.#proposalsDir, `${proposalId}.json`);
    fs.writeFileSync(filePath, JSON.stringify(proposal, null, 2), 'utf8');

    return { proposal, lineageHash };
  }
}
