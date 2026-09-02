#!/usr/bin/env node
import { ProposalManager } from '../src/proposal-manager.js';

const proposalId = process.argv[2];
const decision = process.argv[3]; // 'approved' | 'rejected' | 'deferred'
const notes = process.argv.slice(4).join(' ');

if (!proposalId || !decision) {
  console.error('Usage: node decide-proposal.js <proposalId> <approved|rejected|deferred> [notes]');
  process.exit(1);
}

const manager = new ProposalManager();
try {
  const { proposal, lineageHash } = await manager.decideProposal(proposalId, decision, 'operator:sorensen', notes);
  console.log(JSON.stringify({
    event: 'proposal.decided',
    proposalId: proposal.proposalId,
    status: proposal.status,
    lineageHash,
    decisionLog: proposal.decisionLog,
  }, null, 2));
} catch (err) {
  console.error(`Failed to decide proposal: ${err.message}`);
  process.exit(1);
}
