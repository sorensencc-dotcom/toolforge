import { LocalAuthWiring } from './adapters/LocalAuthWiring.mjs';
import { IcfRetrievalAdapter } from './adapters/IcfRetrievalAdapter-v2.mjs';
import { WhichLlmAdapter } from './adapters/WhichLlmAdapter.mjs';

export class TorqueQueryOrchestrator {
  constructor(options = {}) {
    this.authWiring = new LocalAuthWiring(options.authOptions);
    this.icfAdapter = new IcfRetrievalAdapter(options.icfOptions);
    this.whichLlmAdapter = new WhichLlmAdapter(options.whichLlmOptions);
  }

  async execute(intent) {
    const startTime = Date.now();
    const { query = '', action = 'QUERY', scope = 'S1', requiresStepUp = false } = intent || {};

    // 1. Step 1: Identity & Permission Gate
    const authDecision = await this.authWiring.verifyActionPermission({
      action,
      scope: requiresStepUp ? 'HIGH_RISK' : 'LOW_RISK',
      requiresStepUp
    });

    if (!authDecision.authorized) {
      return {
        status: 'DENIED',
        stepFailed: 'STEP_1_AUTH',
        authDecision,
        groundingPacket: null,
        modelSelection: null,
        executionResult: null,
        latencyMs: Date.now() - startTime
      };
    }

    // 2. Step 2: Knowledge Base Grounding
    const groundingPacket = this.icfAdapter.queryContextCache({ query, maxResults: 5 });

    // 3. Step 3: Model Gating & Routing
    const modelGateDecision = await this.whichLlmAdapter.validateModelGate(scope);

    if (!modelGateDecision.allowed) {
      return {
        status: 'BLOCKED_BY_GATE',
        stepFailed: 'STEP_3_MODEL_GATE',
        authDecision,
        groundingPacket,
        modelGateDecision,
        executionResult: null,
        latencyMs: Date.now() - startTime
      };
    }

    // 4. Step 4: TorqueQuery Deterministic Response Envelope
    const executionResult = {
      engine: 'TorqueQuery-v1',
      modelUsed: modelGateDecision.selectedModel,
      vramTargetGB: modelGateDecision.vramTargetGB,
      sourcesUsed: groundingPacket.sources ? groundingPacket.sources.length : 0,
      contextLength: groundingPacket.contextPacket ? groundingPacket.contextPacket.length : 0,
      deterministicHash: this._computeDeterministicHash(query, groundingPacket, modelGateDecision)
    };

    return {
      status: 'SUCCESS',
      authDecision,
      groundingPacket,
      modelGateDecision,
      executionResult,
      latencyMs: Date.now() - startTime
    };
  }

  _computeDeterministicHash(query, groundingPacket, modelGateDecision) {
    const rawString = `${query}:${groundingPacket.engine}:${modelGateDecision.selectedModel}:${groundingPacket.sources ? groundingPacket.sources.length : 0}`;
    let hash = 0;
    for (let i = 0; i < rawString.length; i++) {
      hash = ((hash << 5) - hash) + rawString.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash).toString(16).padStart(8, '0');
  }
}
