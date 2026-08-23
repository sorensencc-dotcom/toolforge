/**
 * Lineage Integrity Monitor for WhichLLM
 */
import { LineageContract } from '../../cic-whichllm-integration-pack/src/lineage/lineage-contract.js';

export class LineageMonitor {
  #harvesterId;
  #lastVerifiedLength = 0;
  #contract;

  constructor(harvesterId = 'cic-whichllm-default-v1') {
    this.#harvesterId = harvesterId;
    this.#contract = new LineageContract({ harvesterId });
  }

  async auditChain(entries) {
    try {
      const replayer = new LineageContract({
        harvesterId: this.#harvesterId,
        seedChain: entries,
      });
      const valid = await replayer.verify();
      this.#lastVerifiedLength = replayer.length;
      return {
        valid,
        length: replayer.length,
        headHash: replayer.headHash,
        error: null,
      };
    } catch (err) {
      return {
        valid: false,
        length: entries.length,
        headHash: null,
        error: err.message,
      };
    }
  }

  get lastVerifiedLength() {
    return this.#lastVerifiedLength;
  }
}
