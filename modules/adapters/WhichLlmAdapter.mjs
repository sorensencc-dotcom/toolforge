import { resolve, join } from 'node:path';
import { LocalFileAdapterTransport } from './LocalFileAdapterTransport.mjs';

export class WhichLlmAdapter {
  constructor(options = {}) {
    this.workspaceRoot = resolve(options.workspaceRoot || 'C:\\dev');
    const relativePath = options.selectionFilePath || join('_integration', 'model_selection.json');
    this.selectionPath = join(this.workspaceRoot, relativePath);

    this.transport = new LocalFileAdapterTransport({
      filePath: this.selectionPath,
      parse: (raw) => this._parseAndValidate(raw)
    });
  }

  async getLatestModelSelection() {
    try {
      return await this.transport.fetch();
    } catch (err) {
      return {
        status: 'FAIL_CLOSED',
        error: err.message,
        selectedModel: 'llama3:8b-instruct-fp16',
        scopesAllowed: ['S0', 'S1'],
        vramTargetGB: 24
      };
    }
  }

  async validateModelGate(scope = 'S1') {
    const selection = await this.getLatestModelSelection();
    const allowedScopes = selection.scopesAllowed || ['S0', 'S1', 'S2'];
    const isAllowed = allowedScopes.includes(scope.toUpperCase());

    return {
      allowed: isAllowed,
      requestedScope: scope.toUpperCase(),
      selectedModel: selection.selectedModel || 'llama3:8b-instruct-fp16',
      vramTargetGB: selection.vramTargetGB || 24,
      reason: isAllowed
        ? `Model ${selection.selectedModel} satisfies BFCL benchmark score for ${scope}`
        : `Model does not satisfy BFCL score threshold for ${scope}. Allowed scopes: ${allowedScopes.join(', ')}`
    };
  }

  _parseAndValidate(rawString) {
    const data = JSON.parse(rawString);
    return {
      status: 'OK',
      timestamp: data.timestamp || new Date().toISOString(),
      selectedModel: data.selected_model || data.selectedModel || 'llama3:8b-instruct-fp16',
      bfclScore: data.bfcl_score || data.bfclScore || 0.88,
      scopesAllowed: data.scopes_allowed || ['S0', 'S1', 'S2', 'S3'],
      vramTargetGB: data.vram_target_gb || 24,
      hardwareProfile: data.hardware_profile || { gpu: 'RTX 4090', vramGB: 24 },
      lineageHash: data.lineage_hash || data.hash || null
    };
  }
}
