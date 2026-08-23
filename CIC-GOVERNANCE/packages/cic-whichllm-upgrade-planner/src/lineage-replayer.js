/**
 * Lineage Replayer for Upgrades
 */
import { LineageContract } from '../../cic-whichllm-integration-pack/src/lineage/lineage-contract.js';

export class LineageReplayer {
  static async replayAndValidate(harvesterId, entries) {
    const lc = new LineageContract({ harvesterId, seedChain: entries });
    const ok = await lc.verify();
    return {
      success: ok,
      entryCount: lc.length,
      headHash: lc.headHash,
    };
  }
}
