/**
 * scripts/worktree-safety-gate.mjs
 *
 * Pre-Flight Command & Safety Gate (Tier 3 Iron Layer) for Worktree Swarms.
 * Uses local Jev/Ollama Choice classification to evaluate proposed commands:
 * - SAFE_READ: Read-only operations within sandbox
 * - LOCAL_MUTATION: Contained mutations within target worktree sandbox
 * - DANGEROUS_UNSANDBOXED: Unsandboxed mutations, destructive ops, or network/host alterations
 *
 * Verdict:
 * - ALLOWED: SAFE_READ or LOCAL_MUTATION with confidence >= threshold (default 0.70)
 * - BLOCKED: DANGEROUS_UNSANDBOXED, confidence < threshold, or safety violations (requires manual step-up confirmation)
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_JEV_URL = process.env.JEV_BASE_URL || 'http://127.0.0.1:4173/v1/systemone';
const MIN_CONFIDENCE_THRESHOLD = 0.70;

const STATIC_SAFE_READ_PATTERNS = [
  /^(git\s+(status|diff|log|branch|show|rev-parse))/i,
  /^(ls|dir|pwd|Get-Location|Get-ChildItem)(\s|$)/i,
  /^(cat|head|tail|grep|findstr|type)\s+/i,
  /^(node\s+--test|npm\s+test|npm\s+run\s+test)/i,
];

const STATIC_DANGEROUS_PATTERNS = [
  /rm\s+(-[rfRF]{1,4}\s+)?(\/|[a-zA-Z]:\\|\*)/i,
  /DROP\s+(TABLE|DATABASE|SCHEMA)/i,
  /git\s+push(\s+.*)?\s+(--force|-f)\s+(origin\s+)?(main|master)/i,
  /git\s+(reset\s+--hard|clean\s+-[fFxdD]+)/i,
  /curl\s+.*\|\s*(sh|bash|pwsh|cmd)/i,
  /(format|mkfs|dd\s+if=)/i,
];

/**
 * Evaluates command safety using fast static heuristics + local Jev Choice classification
 *
 * @param {string} command The shell command to evaluate
 * @param {Object} [options]
 * @param {string} [options.worktreeRoot] Absolute path to the active worktree sandbox
 * @param {number} [options.confidenceThreshold] Minimum confidence score (default 0.70)
 * @param {string} [options.baseUrl] Local Jev/SystemOne endpoint
 * @param {Function} [options.fetchImpl] Custom fetch implementation
 * @returns {Promise<{verdict: 'ALLOWED'|'BLOCKED', classification: string, confidence: number, reason: string}>}
 */
export async function evaluateCommandSafety(command, options = {}) {
  const {
    worktreeRoot = process.cwd(),
    confidenceThreshold = MIN_CONFIDENCE_THRESHOLD,
    baseUrl = DEFAULT_JEV_URL,
    fetchImpl = globalThis.fetch,
  } = options;

  if (!command || typeof command !== 'string' || !command.trim()) {
    return {
      verdict: 'BLOCKED',
      classification: 'INVALID',
      confidence: 1.0,
      reason: 'Empty or invalid command string',
    };
  }

  const trimmed = command.trim();

  // Fast-path 1: Obvious static dangerous commands -> immediate BLOCK
  for (const pattern of STATIC_DANGEROUS_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        verdict: 'BLOCKED',
        classification: 'DANGEROUS_UNSANDBOXED',
        confidence: 1.0,
        reason: `Matched static high-risk pattern: ${pattern}`,
      };
    }
  }

  // Fast-path 2: Obvious pure read commands -> immediate ALLOW
  for (const pattern of STATIC_SAFE_READ_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        verdict: 'ALLOWED',
        classification: 'SAFE_READ',
        confidence: 1.0,
        reason: 'Matched static safe-read pattern',
      };
    }
  }

  // Jev / Ollama Choice Primitive Evaluation
  try {
    const response = await fetchImpl(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        state: {
          worktree_root: worktreeRoot,
          command: trimmed,
        },
        questions: {
          safety_class: {
            type: 'choice',
            choices: ['SAFE_READ', 'LOCAL_MUTATION', 'DANGEROUS_UNSANDBOXED'],
            instructions:
              'Classify this shell command into SAFE_READ (read-only), LOCAL_MUTATION (modifies files only within the active worktree), or DANGEROUS_UNSANDBOXED (modifies system files, global dependencies, drops databases, or destructive actions).',
          },
        },
      }),
    });

    if (response.ok) {
      const data = await response.json();
      const answer = data.answers?.safety_class;
      const choice = answer?.choice || answer?.value || 'DANGEROUS_UNSANDBOXED';
      const confidence = typeof answer?.confidence === 'number' ? answer.confidence : 0.85;

      if (choice === 'DANGEROUS_UNSANDBOXED' || confidence < confidenceThreshold) {
        return {
          verdict: 'BLOCKED',
          classification: choice,
          confidence,
          reason:
            choice === 'DANGEROUS_UNSANDBOXED'
              ? 'Classified as DANGEROUS_UNSANDBOXED by Jev safety gate'
              : `Confidence (${confidence.toFixed(2)}) below required threshold (${confidenceThreshold.toFixed(2)})`,
        };
      }

      return {
        verdict: 'ALLOWED',
        classification: choice,
        confidence,
        reason: `Classified as ${choice} with confidence ${confidence.toFixed(2)}`,
      };
    }
  } catch {
    // Local Jev engine offline / error: fail-safe policy for safety gate is BLOCKED
    return {
      verdict: 'BLOCKED',
      classification: 'UNAVAILABLE',
      confidence: 0.0,
      reason: 'Safety engine unreachable; fail-safe block engaged',
    };
  }

  return {
    verdict: 'BLOCKED',
    classification: 'DANGEROUS_UNSANDBOXED',
    confidence: 0.5,
    reason: 'Default safety fall-through',
  };
}

// CLI Execution Support
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const args = process.argv.slice(2);
  const commandArg = args.find((a) => !a.startsWith('--'));
  const thresholdArg = args.find((a) => a.startsWith('--threshold='));
  const confidenceThreshold = thresholdArg ? parseFloat(thresholdArg.split('=')[1]) : MIN_CONFIDENCE_THRESHOLD;

  if (!commandArg) {
    console.error('Usage: node scripts/worktree-safety-gate.mjs "<command>" [--threshold=0.70]');
    process.exit(1);
  }

  const result = await evaluateCommandSafety(commandArg, { confidenceThreshold });
  console.log(JSON.stringify(result, null, 2));

  if (result.verdict !== 'ALLOWED') {
    process.exit(1);
  }
}
