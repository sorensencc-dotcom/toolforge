/**
 * scripts/dom-action-selector.mjs
 *
 * Autonomous Web Ingest & DOM Action Selector (browser-use/jev-ultrafast pattern).
 * Evaluates candidate interactive elements from a DOM snapshot against an agent's goal
 * in sub-second time using local Jev/Ollama Choice classification.
 * Wakes heavy generative LLMs only when freeform text synthesis/typing is strictly required.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_JEV_URL = process.env.JEV_BASE_URL || 'http://127.0.0.1:4173/v1/systemone';
const MIN_CONFIDENCE_THRESHOLD = 0.65;

/**
 * Select the optimal DOM interaction target given a navigation goal and interactive elements
 *
 * @param {string} goal High-level agent action goal (e.g., "Click on Next Page button")
 * @param {Array<Object>} elements List of interactive DOM nodes [{ id, tag, text, role, selector, type }]
 * @param {Object} [options]
 * @param {string} [options.baseUrl] Local Jev/SystemOne endpoint
 * @param {number} [options.confidenceThreshold] Minimum confidence score (default 0.65)
 * @param {Function} [options.fetchImpl] Custom fetch for tests
 * @returns {Promise<{action: 'CLICK'|'SCROLL'|'TYPE_REQUIRED'|'NO_MATCH', targetElementId: string|null, confidence: number, reason: string, latencyMs: number}>}
 */
export async function selectDomAction(goal, elements = [], options = {}) {
  const startTime = Date.now();
  const {
    baseUrl = DEFAULT_JEV_URL,
    confidenceThreshold = MIN_CONFIDENCE_THRESHOLD,
    fetchImpl = globalThis.fetch,
  } = options;

  if (!goal || typeof goal !== 'string' || !goal.trim() || !Array.isArray(elements) || elements.length === 0) {
    return {
      action: 'NO_MATCH',
      targetElementId: null,
      confidence: 1.0,
      reason: 'Empty goal or candidate elements list',
      latencyMs: Date.now() - startTime,
    };
  }

  const cleanGoal = goal.trim().toLowerCase();

  // Fast-path: Exact text/role matches for common patterns (cookies, pagination, login)
  for (const el of elements) {
    const elText = (el.text || '').trim().toLowerCase();
    const elId = el.id || el.selector || 'unknown';

    if (
      (cleanGoal.includes('cookie') && elText.includes('accept')) ||
      (cleanGoal.includes('next') && elText === 'next') ||
      (cleanGoal.includes('submit') && (elText === 'submit' || el.type === 'submit'))
    ) {
      return {
        action: 'CLICK',
        targetElementId: elId,
        confidence: 0.98,
        reason: `Fast-path exact heuristic match on element text: "${el.text}"`,
        latencyMs: Date.now() - startTime,
      };
    }
  }

  // Check if target is an input field requiring typing
  const inputElements = elements.filter(
    (el) => el.tag === 'input' || el.tag === 'textarea' || el.role === 'searchbox' || el.role === 'textbox'
  );
  if (cleanGoal.startsWith('type ') || cleanGoal.startsWith('enter ') || cleanGoal.startsWith('search for ')) {
    if (inputElements.length === 1) {
      return {
        action: 'TYPE_REQUIRED',
        targetElementId: inputElements[0].id || inputElements[0].selector,
        confidence: 0.95,
        reason: 'Direct target input identified; generative LLM typing step required',
        latencyMs: Date.now() - startTime,
      };
    }
  }

  // Format candidate space for Jev Choice (capped at top 30 interactive candidates)
  const candidateList = elements.slice(0, 30).map((el) => ({
    id: String(el.id || el.selector),
    summary: `<${el.tag || 'elem'} role="${el.role || ''}"> ${el.text || el.placeholder || el.title || ''}`.trim(),
  }));

  const choices = candidateList.map((c) => c.id).concat(['NO_MATCH']);

  try {
    const response = await fetchImpl(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        state: {
          navigation_goal: goal,
          candidates: candidateList,
        },
        questions: {
          target_action: {
            type: 'choice',
            choices,
            instructions:
              'Select the single candidate element ID that best satisfies the navigation goal, or NO_MATCH if none apply.',
          },
        },
      }),
    });

    if (response.ok) {
      const data = await response.json();
      const answer = data.answers?.target_action;
      const selectedId = answer?.choice || answer?.value || 'NO_MATCH';
      const confidence = typeof answer?.confidence === 'number' ? answer.confidence : 0.85;

      if (selectedId === 'NO_MATCH' || confidence < confidenceThreshold) {
        return {
          action: 'NO_MATCH',
          targetElementId: null,
          confidence,
          reason:
            selectedId === 'NO_MATCH'
              ? 'No candidate element satisfied navigation goal'
              : `Confidence (${confidence.toFixed(2)}) below required threshold (${confidenceThreshold.toFixed(2)})`,
          latencyMs: Date.now() - startTime,
        };
      }

      const targetEl = elements.find((e) => String(e.id || e.selector) === selectedId);
      const isInput =
        targetEl && (targetEl.tag === 'input' || targetEl.tag === 'textarea' || targetEl.role === 'textbox');

      return {
        action: isInput ? 'TYPE_REQUIRED' : 'CLICK',
        targetElementId: selectedId,
        confidence,
        reason: `Selected element ${selectedId} via Jev Choice (conf: ${confidence.toFixed(2)})`,
        latencyMs: Date.now() - startTime,
      };
    }
  } catch {
    // Fail-safe: fallback to NO_MATCH on engine offline
  }

  return {
    action: 'NO_MATCH',
    targetElementId: null,
    confidence: 0.0,
    reason: 'Jev engine unreachable or evaluation failed',
    latencyMs: Date.now() - startTime,
  };
}

// CLI Execution Support
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const args = process.argv.slice(2);
  const snapshotFile = args.find((a) => !a.startsWith('--'));
  const goalArg = args.find((a) => a.startsWith('--goal='));
  const goal = goalArg ? goalArg.replace('--goal=', '') : 'Click target element';

  if (!snapshotFile) {
    console.error('Usage: node scripts/dom-action-selector.mjs <elements.json> --goal="<goal>"');
    process.exit(1);
  }

  try {
    const raw = await fs.readFile(path.resolve(snapshotFile), 'utf-8');
    const elements = JSON.parse(raw);
    const result = await selectDomAction(goal, Array.isArray(elements) ? elements : elements.elements || []);
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}
