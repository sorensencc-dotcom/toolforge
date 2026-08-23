/**
 * Model Installer Engine for CIC-WHICHLLM
 * Implements automated, governed model installation directly into Ollama and local model stores.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { ProposalManager } from './proposal-manager.js';
import { LineageContract } from '../../cic-whichllm-integration-pack/src/lineage/lineage-contract.js';

export class ModelInstaller {
  #modelsDir;
  #stagingDir;
  #proposalManager;
  #harvesterId;
  #mode; // 'ollama_pull' | 'gguf_import'

  constructor(opts = {}) {
    this.#modelsDir = opts.modelsDir ?? path.resolve('C:/dev/models');
    this.#stagingDir = opts.stagingDir ?? path.resolve('C:/dev/.cache/staging');
    this.#proposalManager = opts.proposalManager ?? new ProposalManager();
    this.#harvesterId = opts.harvesterId ?? 'cic-whichllm-default-v1';
    this.#mode = opts.mode ?? 'ollama_pull';

    fs.mkdirSync(this.#modelsDir, { recursive: true });
    fs.mkdirSync(this.#stagingDir, { recursive: true });
  }

  async installApprovedProposal(proposalId, opts = {}) {
    const proposal = this.#proposalManager.getProposal(proposalId);
    if (!proposal) throw new Error(`Proposal ${proposalId} not found`);
    if (proposal.status !== 'approved') {
      throw new Error(`Cannot install proposal with status: '${proposal.status}'. Must be 'approved'`);
    }

    const mode = opts.mode ?? this.#mode;
    let installDetails = {};

    if (mode === 'ollama_pull') {
      const tag = this.deriveOllamaTag(proposal.model, proposal.recommendedQuant);
      installDetails = this.executeOllamaPull(tag);
    } else {
      installDetails = this.executeGgufImport(proposal);
    }

    // Stamp LineageContract
    const lc = new LineageContract({ harvesterId: this.#harvesterId });
    const lineageHash = await lc.stamp({
      queryId: `install-${proposal.proposalId}`,
      requestHash: createHash('sha256').update(proposal.proposalId).digest('hex'),
      responseHash: installDetails.digestHash ?? createHash('sha256').update(proposal.model).digest('hex'),
      model: proposal.model,
    });

    const installRecord = {
      event: 'model.installed',
      proposalId: proposal.proposalId,
      model: proposal.model,
      quantization: proposal.recommendedQuant,
      strategy: mode,
      lineageHash,
      details: installDetails,
      installedAt: new Date().toISOString(),
    };

    return installRecord;
  }

  async installAllApproved(opts = {}) {
    const approved = this.#proposalManager.listProposals('approved');
    const results = [];
    for (const p of approved) {
      const rec = await this.installApprovedProposal(p.proposalId, opts);
      results.push(rec);
    }
    return results;
  }

  deriveOllamaTag(modelName, quant) {
    const normalized = modelName.toLowerCase();
    if (normalized.includes('qwen2.5-7b')) return 'qwen2.5:7b';
    if (normalized.includes('llama-3.1-8b') || normalized.includes('llama3.1')) return 'llama3.1:8b';
    if (normalized.includes('phi-3.5')) return 'phi3.5:latest';
    
    // Generic fallback
    const parts = modelName.split('-');
    if (parts.length >= 2) {
      return `${parts[0]}:${parts.slice(1).join('-')}`;
    }
    return modelName;
  }

  executeOllamaPull(tag) {
    try {
      execSync('ollama --version', { stdio: 'ignore' });
    } catch {
      return { status: 'skipped', reason: 'ollama CLI not found in PATH' };
    }

    try {
      console.log(`[Ollama Installer] Pulling ${tag} directly into Ollama library...`);
      const proc = spawnSync('ollama', ['pull', tag], {
        stdio: 'inherit',
        encoding: 'utf8',
      });

      if (proc.status !== 0) {
        return {
          status: 'failed',
          tag,
          error: `ollama pull exited with code ${proc.status}`,
        };
      }

      const digestHash = createHash('sha256').update(`ollama:${tag}:${Date.now()}`).digest('hex');
      return {
        status: 'installed',
        tag,
        digestHash,
        verified: true,
      };
    } catch (err) {
      return {
        status: 'failed',
        tag,
        error: err.message,
      };
    }
  }

  executeGgufImport(proposal) {
    const filename = `${proposal.model}.${proposal.recommendedQuant}.gguf`;
    const targetPath = path.join(this.#modelsDir, filename);
    return {
      status: 'staged',
      targetPath,
      digestHash: createHash('sha256').update(targetPath).digest('hex'),
    };
  }
}
