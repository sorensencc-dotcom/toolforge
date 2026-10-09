/**
 * scripts/whichllm-router.mjs
 *
 * Multi-Model Cost-Routing & Pipeline Gateway (WhichLLM v3.0 / Middleware).
 * Evaluates tasks across a 4-tier cost and capability spectrum:
 * - Tier 0 Local: Offline Ollama (localhost:11434)
 * - Tier 0.5 FreeLLMAPI: Best-effort local proxy (localhost:3001)
 * - Tier 1 Muscle Cloud: OpenRouter / DeepSeek / Mistral Large 123B
 * - Tier 2 Frontier Cloud: Claude 3.5 Sonnet / GPT-4o
 *
 * Backward-compatible with Jev Decision Primitives and TRM Bot runners.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MODEL_SELECTION_PATH = path.resolve(process.cwd(), '_integration/model_selection.json');
const STATUS_FEED_PATH = path.resolve(process.cwd(), '_status-feed/cost_routing_status.json');

export const FRONTIER_PRICING_BASELINE_V1 = {
  model: 'anthropic/claude-3-5-sonnet',
  inputCostPer1M: 3.00,
  outputCostPer1M: 15.00,
  version: '2024-10-22-baseline'
};

export const DEFAULT_MODELS = {
  tier_0_local: 'llama3.1:8b',
  tier_0_5_freellmapi: 'freellm/auto',
  tier_1_muscle: 'mistralai/mistral-large-2407',
  tier_2_frontier: 'claude-3-5-sonnet-20241022'
};

/**
 * Fast regex patterns for obvious routes
 */
const STATIC_TIER0_PATTERNS = [
  /^(format|lint|prettify|fix typo|rename variable)\b/i,
  /^(run tests?|npm test|node --test)\b/i,
  /^(find|locate|grep|search for)\s+["']?[a-zA-Z0-9_\-\.]+["']?\b/i,
  /^(extract|convert)\s+(json|csv|markdown)\b/i,
  /\b(triage|tag gap|extract citations|parse frontmatter)\b/i,
];

const STATIC_TIER1_PATTERNS = [
  /\b(refactor across|rewrite subsystem|large context|bulk code|summarize repo)\b/i,
  /\b(128k|32k|benchmark-chonk|multi-file)\b/i,
];

const STATIC_TIER2_PATTERNS = [
  /\b(architect|redesign|system design|security audit|threat model)\b/i,
  /\b(multi-agent|cross-repo|distributed consensus|governance policy)\b/i,
  /\b(formal proof|theorem|lean4|lake|invariant verification)\b/i,
];

/**
 * Loads anchors from model_selection.json if available
 */
export async function loadModelAnchors() {
  try {
    const raw = await fs.readFile(MODEL_SELECTION_PATH, 'utf-8');
    const data = JSON.parse(raw);
    return {
      frontier: data.recommendations?.frontier_judgment_anchor || DEFAULT_MODELS.tier_2_frontier,
      muscle: data.recommendations?.cloud_muscle_anchor || DEFAULT_MODELS.tier_1_muscle,
      local: data.recommendations?.local_muscle_anchor || DEFAULT_MODELS.tier_0_local,
    };
  } catch {
    return {
      frontier: DEFAULT_MODELS.tier_2_frontier,
      muscle: DEFAULT_MODELS.tier_1_muscle,
      local: DEFAULT_MODELS.tier_0_local,
    };
  }
}

/**
 * Route an incoming task across the 4-tier cost router.
 *
 * @param {string} taskDescription The incoming user request or prompt
 * @param {Object} [options]
 * @param {string} [options.forceTier] Force routing to a specific tier
 * @param {string} [options.taskType] Task category hint
 * @param {Function} [options.fetchImpl] Custom fetch for tests
 * @param {Object} [options.modelAnchors] Custom model anchor mappings
 * @returns {Promise<{tier: string, tierId: string, targetModel: string, confidence: number, reason: string, estimatedCostUsd: number, estimatedSavingsUsd: number, latencyMs: number}>}
 */
export async function routeTask(taskDescription, options = {}) {
  const startTime = Date.now();
  const { forceTier, taskType, fetchImpl = globalThis.fetch, modelAnchors } = options;

  const anchors = modelAnchors || (await loadModelAnchors());

  if (!taskDescription || typeof taskDescription !== 'string' || !taskDescription.trim()) {
    return {
      tier: 'Tier 1 (Judgment)',
      tierId: 'tier_2_frontier',
      targetModel: anchors.frontier,
      confidence: 1.0,
      reason: 'Empty prompt defaulted to Tier 2 Frontier anchor',
      estimatedCostUsd: 0.015,
      estimatedSavingsUsd: 0.0,
      latencyMs: Date.now() - startTime,
    };
  }

  const trimmed = taskDescription.trim();

  // Manual Override
  if (forceTier) {
    const isFrontier = forceTier === 'tier_2_frontier';
    return {
      tier: isFrontier ? 'Tier 1 (Judgment)' : 'Tier 2 (Muscle)',
      tierId: forceTier,
      targetModel: isFrontier ? anchors.frontier : forceTier === 'tier_1_muscle' ? anchors.muscle : anchors.local,
      confidence: 1.0,
      reason: `Manual tier override: ${forceTier}`,
      estimatedCostUsd: isFrontier ? 0.015 : forceTier === 'tier_1_muscle' ? 0.002 : 0.0,
      estimatedSavingsUsd: isFrontier ? 0.0 : forceTier === 'tier_1_muscle' ? 0.013 : 0.015,
      latencyMs: Date.now() - startTime,
    };
  }

  // Fast-path: Static Tier 2 Frontier matches
  for (const pattern of STATIC_TIER2_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        tier: 'Tier 1 (Judgment)',
        tierId: 'tier_2_frontier',
        targetModel: anchors.frontier,
        confidence: 0.95,
        reason: 'Matched high-complexity/architectural/formal proof heuristic',
        estimatedCostUsd: 0.015,
        estimatedSavingsUsd: 0.0,
        latencyMs: Date.now() - startTime,
      };
    }
  }

  // Fast-path: Static Tier 1 Muscle matches
  for (const pattern of STATIC_TIER1_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        tier: 'Tier 2 (Muscle)',
        tierId: 'tier_1_muscle',
        targetModel: anchors.muscle,
        confidence: 0.90,
        reason: 'Matched large context / bulk refactor muscle heuristic',
        estimatedCostUsd: 0.002,
        estimatedSavingsUsd: 0.013,
        latencyMs: Date.now() - startTime,
      };
    }
  }

  // Fast-path: Static Tier 0 Local matches
  for (const pattern of STATIC_TIER0_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        tier: 'Tier 2 (Muscle)',
        tierId: 'tier_0_local',
        targetModel: anchors.local,
        confidence: 0.95,
        reason: 'Matched localized/extraction task heuristic ($0 cost)',
        estimatedCostUsd: 0.0,
        estimatedSavingsUsd: 0.015,
        latencyMs: Date.now() - startTime,
      };
    }
  }

  // Dynamic Choice fallback (Jev/Ollama/Gateway endpoint)
  try {
    const jevUrl = process.env.JEV_BASE_URL || 'http://127.0.0.1:4173/v1/systemone';
    const response = await fetchImpl(jevUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        state: { task: trimmed },
        questions: {
          routing_tier: {
            type: 'choice',
            choices: ['TIER_1_JUDGMENT', 'TIER_2_MUSCLE'],
            instructions: 'Evaluate if this task requires TIER_1_JUDGMENT or TIER_2_MUSCLE.',
          },
        },
      }),
    });

    if (response.ok) {
      const data = await response.json();
      const answer = data.answers?.routing_tier;
      const choice = answer?.choice || answer?.value || 'TIER_1_JUDGMENT';
      const confidence = typeof answer?.confidence === 'number' ? answer.confidence : 0.85;

      if (choice === 'TIER_2_MUSCLE' && confidence >= 0.65) {
        return {
          tier: 'Tier 2 (Muscle)',
          tierId: 'tier_0_local',
          targetModel: anchors.local,
          confidence,
          reason: `Routed to local muscle (${anchors.local}) via Choice classifier (conf: ${confidence.toFixed(2)})`,
          estimatedCostUsd: 0.0,
          estimatedSavingsUsd: 0.015,
          latencyMs: Date.now() - startTime,
        };
      }

      return {
        tier: 'Tier 1 (Judgment)',
        tierId: 'tier_2_frontier',
        targetModel: anchors.frontier,
        confidence,
        reason: `Routed to frontier anchor (${anchors.frontier}) via Choice classifier (conf: ${confidence.toFixed(2)})`,
        estimatedCostUsd: 0.015,
        estimatedSavingsUsd: 0.0,
        latencyMs: Date.now() - startTime,
      };
    }
  } catch {
    // Fail-safe
  }

  // Default fail-safe
  return {
    tier: 'Tier 1 (Judgment)',
    tierId: 'tier_2_frontier',
    targetModel: anchors.frontier,
    confidence: 0.5,
    reason: 'Dynamic classifier offline; default fail-safe to Tier 2 Frontier',
    estimatedCostUsd: 0.015,
    estimatedSavingsUsd: 0.0,
    latencyMs: Date.now() - startTime,
  };
}

// CLI Execution Support
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const taskArg = process.argv.slice(2).join(' ');

  if (!taskArg.trim()) {
    console.error('Usage: node scripts/whichllm-router.mjs "<task description>"');
    process.exit(1);
  }

  const result = await routeTask(taskArg);
  console.log(JSON.stringify(result, null, 2));
}
