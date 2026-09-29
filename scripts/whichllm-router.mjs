/**
 * scripts/whichllm-router.mjs
 *
 * Contextual Model & Pipeline Router (WhichLLM / Middleware).
 * Evaluates incoming tasks against capability and complexity criteria in milliseconds,
 * routing direct lookups and localized edits to Tier 2 Local Muscle (Ollama / resident weights)
 * while escalating architectural decisions and complex refactoring to Tier 1 Frontier Judgment.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_JEV_URL = process.env.JEV_BASE_URL || 'http://127.0.0.1:4173/v1/systemone';
const MODEL_SELECTION_PATH = path.resolve(process.cwd(), '_integration/model_selection.json');

const DEFAULT_FRONTIER_MODEL = 'claude-3-5-sonnet-20241022';
const DEFAULT_LOCAL_MODEL = 'qwen2.5:7b';

/**
 * Loads anchors from model_selection.json if available
 */
async function loadModelAnchors() {
  try {
    const raw = await fs.readFile(MODEL_SELECTION_PATH, 'utf-8');
    const data = JSON.parse(raw);
    return {
      frontier: data.recommendations?.frontier_judgment_anchor || DEFAULT_FRONTIER_MODEL,
      local: data.recommendations?.local_muscle_anchor || DEFAULT_LOCAL_MODEL,
    };
  } catch {
    return {
      frontier: DEFAULT_FRONTIER_MODEL,
      local: DEFAULT_LOCAL_MODEL,
    };
  }
}

/**
 * Fast regex patterns for obvious routes
 */
const STATIC_TIER2_PATTERNS = [
  /^(format|lint|prettify|fix typo|rename variable)\b/i,
  /^(run tests?|npm test|node --test)\b/i,
  /^(find|locate|grep|search for)\s+["']?[a-zA-Z0-9_\-\.]+["']?\b/i,
  /^(extract|convert)\s+(json|csv|markdown)\b/i,
];

const STATIC_TIER1_PATTERNS = [
  /\b(architect|redesign|system design|security audit|threat model)\b/i,
  /\b(multi-agent|cross-repo|distributed consensus|governance policy)\b/i,
  /\b(refactor across|rewrite subsystem|migration plan)\b/i,
];

/**
 * Route an incoming task to Tier 1 Judgment or Tier 2 Muscle
 *
 * @param {string} taskDescription The incoming user request or prompt
 * @param {Object} [options]
 * @param {string} [options.baseUrl] Local Jev/SystemOne endpoint
 * @param {Function} [options.fetchImpl] Custom fetch for tests
 * @param {Object} [options.modelAnchors] Custom model anchor mappings
 * @returns {Promise<{tier: 'Tier 1 (Judgment)'|'Tier 2 (Muscle)', targetModel: string, confidence: number, reason: string, latencyMs: number}>}
 */
export async function routeTask(taskDescription, options = {}) {
  const startTime = Date.now();
  const { baseUrl = DEFAULT_JEV_URL, fetchImpl = globalThis.fetch, modelAnchors } = options;

  const anchors = modelAnchors || (await loadModelAnchors());

  if (!taskDescription || typeof taskDescription !== 'string' || !taskDescription.trim()) {
    return {
      tier: 'Tier 1 (Judgment)',
      targetModel: anchors.frontier,
      confidence: 1.0,
      reason: 'Empty prompt defaulted to Tier 1 anchor',
      latencyMs: Date.now() - startTime,
    };
  }

  const trimmed = taskDescription.trim();

  // Fast-path: Static Tier 2 matches
  for (const pattern of STATIC_TIER2_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        tier: 'Tier 2 (Muscle)',
        targetModel: anchors.local,
        confidence: 0.95,
        reason: 'Matched localized/muscle task heuristic',
        latencyMs: Date.now() - startTime,
      };
    }
  }

  // Fast-path: Static Tier 1 matches
  for (const pattern of STATIC_TIER1_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        tier: 'Tier 1 (Judgment)',
        targetModel: anchors.frontier,
        confidence: 0.95,
        reason: 'Matched high-complexity/architectural task heuristic',
        latencyMs: Date.now() - startTime,
      };
    }
  }

  // Local Jev / Ollama Choice Primitive
  try {
    const response = await fetchImpl(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        state: {
          task: trimmed,
        },
        questions: {
          routing_tier: {
            type: 'choice',
            choices: ['TIER_1_JUDGMENT', 'TIER_2_MUSCLE'],
            instructions:
              'Evaluate if this task requires TIER_1_JUDGMENT (architectural reasoning, multi-file refactoring, deep logic, security) or TIER_2_MUSCLE (single-file edits, direct lookups, syntax transforms, simple utilities).',
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
          targetModel: anchors.local,
          confidence,
          reason: `Routed to local muscle (${anchors.local}) via Jev Choice (conf: ${confidence.toFixed(2)})`,
          latencyMs: Date.now() - startTime,
        };
      }

      return {
        tier: 'Tier 1 (Judgment)',
        targetModel: anchors.frontier,
        confidence,
        reason: `Routed to frontier anchor (${anchors.frontier}) via Jev Choice (conf: ${confidence.toFixed(2)})`,
        latencyMs: Date.now() - startTime,
      };
    }
  } catch {
    // Fail-safe: default to Tier 1 frontier when router engine is offline
  }

  return {
    tier: 'Tier 1 (Judgment)',
    targetModel: anchors.frontier,
    confidence: 0.5,
    reason: 'Jev engine offline or uncertain; default fail-safe to Tier 1 frontier',
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
