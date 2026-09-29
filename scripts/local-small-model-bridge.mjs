#!/usr/bin/env node
/**
 * scripts/local-small-model-bridge.mjs
 *
 * Local Small-Model Bridge (Ollama / Qwen 2.5 / Llama 3.2).
 * Zero-token, privacy-preserving, zero-cost local inference integration for:
 * 1. Unstructured mobile voice/text intent extraction into structured TRM action cards.
 * 2. CI build log & stack trace root-cause summarization for CI-Watchdog.
 *
 * Includes deterministic heuristic fallbacks when Ollama is offline or in dry-run mode.
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

export const REPO_ROOT = path.resolve(import.meta.dirname, '..');

export const DEFAULT_OLLAMA_HOST = process.env.OLLAMA_HOST || '127.0.0.1';
export const DEFAULT_OLLAMA_PORT = parseInt(process.env.OLLAMA_PORT || '11434', 10) || 11434;
export const DEFAULT_OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || `http://${DEFAULT_OLLAMA_HOST}:${DEFAULT_OLLAMA_PORT}`;
export const PREFERRED_MODELS = ['qwen2.5:latest', 'qwen2.5:7b', 'llama3.2:latest', 'llama3.2:3b', 'qwen2.5:3b', 'mistral:latest'];

/**
 * Validate that host is strictly a loopback address to ensure zero-token, privacy-preserving local execution.
 */
export function isLoopbackHostname(hostname) {
  const h = (hostname || '').toLowerCase().replace(/^\[|\]$/g, '');
  return h === 'localhost' || h === '127.0.0.1' || h === '::1' || h.startsWith('127.');
}

export function validateLoopbackUrl(endpoint, baseUrl) {
  const url = new URL(endpoint, baseUrl);
  if (!isLoopbackHostname(url.hostname)) {
    throw new Error(`Security Violation: Non-loopback endpoint rejected (${url.origin}). Local small-model bridge is strictly restricted to on-device loopback execution.`);
  }
  return url;
}

/**
 * Perform a raw HTTP POST request to Ollama API with timeout.
 */
export async function queryOllama(endpoint, payload, options = {}) {
  const baseUrl = options.baseUrl || DEFAULT_OLLAMA_BASE_URL;
  const timeoutMs = options.timeoutMs || 8000;
  const url = validateLoopbackUrl(endpoint, baseUrl);

  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(payload);
    const req = http.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      },
      timeout: timeoutMs
    }, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(data));
          } catch {
            resolve(data);
          }
        } else {
          reject(new Error(`Ollama API HTTP ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('timeout', () => {
      req.destroy(new Error(`Ollama API request timed out after ${timeoutMs}ms`));
      reject(new Error(`Ollama API request timed out after ${timeoutMs}ms`));
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.write(postData);
    req.end();
  });
}

/**
 * Check health and model availability of local Ollama instance.
 */
export async function checkOllamaHealth(options = {}) {
  const baseUrl = options.baseUrl || DEFAULT_OLLAMA_BASE_URL;
  const timeoutMs = options.timeoutMs || 2000;
  let url;
  try {
    url = validateLoopbackUrl('/api/tags', baseUrl);
  } catch (err) {
    return { available: false, error: err.message };
  }

  return new Promise((resolve) => {
    const req = http.request(url, {
      method: 'GET',
      timeout: timeoutMs
    }, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const parsed = JSON.parse(data);
            const models = (parsed.models || []).map(m => m.name);
            const selectedModel = PREFERRED_MODELS.find(m => models.includes(m)) || models[0] || 'qwen2.5:latest';
            resolve({
              available: true,
              statusCode: 200,
              models,
              selectedModel,
              baseUrl
            });
          } catch {
            resolve({ available: false, error: 'Invalid JSON response from Ollama' });
          }
        } else {
          resolve({ available: false, statusCode: res.statusCode });
        }
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({ available: false, error: 'Timeout' });
    });

    req.on('error', (err) => {
      resolve({ available: false, error: err.message });
    });

    req.end();
  });
}

/**
 * Fallback deterministic rule engine for intent extraction.
 */
export function extractIntentDeterministic(rawText, metadata = {}) {
  const text = String(rawText || '').trim();
  const lower = text.toLowerCase();
  const timestamp = metadata.timestamp || new Date().toISOString();
  const id = metadata.id || `act-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const source = metadata.source || 'mobile-voice-bridge';

  // Detect priority
  let priority = 'P2';
  if (/\b(urgent|critical|p0|p1|blocker|immediately)\b/i.test(lower)) {
    priority = 'P1';
  } else if (/\b(low|p3|someday|minor)\b/i.test(lower)) {
    priority = 'P3';
  }

  // Detect target notebook
  let targetNotebook = metadata.target_notebook || null;
  let targetNotebookName = metadata.target_notebook_name || null;
  const nbMatch = text.match(/notebook\s+["']?([^"',.\n]+)["']?/i);
  if (nbMatch) {
    targetNotebookName = nbMatch[1].trim();
  }

  // 1. Remediate quarantine / ENOBUFS
  if (/quarantine|enobufs|buffer overflow|consolidate pack/i.test(lower)) {
    return {
      id,
      timestamp,
      source,
      action_type: 'deterministic_fix',
      intent: 'remediate_quarantine_enobufs',
      priority,
      target_notebook: targetNotebook,
      target_notebook_name: targetNotebookName || 'TRM Knowledge Base',
      summary: text,
      execution_plan: [
        { step: 1, handler: 'ironbot', action: 'consolidate_pack', command: 'node scripts/consolidate-pack.mjs --max-size 380k' }
      ],
      context: {
        raw_input: text,
        provider: 'deterministic_fallback',
        parameters: { budget_rule: '380k' }
      }
    };
  }

  // 2. Prune dead or duplicate sources
  if (/prune|delete (failed|dead|dup|duplicate)|cleanup sources/i.test(lower)) {
    return {
      id,
      timestamp,
      source,
      action_type: 'deterministic_fix',
      intent: 'prune_dead_sources',
      priority,
      target_notebook: targetNotebook,
      target_notebook_name: targetNotebookName,
      summary: text,
      execution_plan: [
        { step: 1, handler: 'ironbot', action: 'cleanup_duplicates', command: 'node scripts/cleanup-nlm-duplicates.mjs' }
      ],
      context: {
        raw_input: text,
        provider: 'deterministic_fallback'
      }
    };
  }

  // 3. Antigravity Triage (Codebase investigation, PR reviews, CI issues)
  return {
    id,
    timestamp,
    source,
    action_type: 'antigravity_triage',
    intent: lower.includes('ci') ? 'investigate_ci_failure' : lower.includes('review') ? 'review_pr' : 'triage_mobile_request',
    priority,
    target_notebook: targetNotebook,
    target_notebook_name: targetNotebookName,
    summary: text,
    execution_plan: [
      { step: 1, handler: 'antigravity', action: 'create_issue_and_stage' }
    ],
    context: {
      raw_input: text,
      provider: 'deterministic_fallback'
    }
  };
}

/**
 * Extract structured mobile intent using local LLM with deterministic fallback.
 */
export async function extractMobileIntent(rawText, metadata = {}, options = {}) {
  const text = String(rawText || '').trim();
  if (!text) {
    throw new Error('Cannot extract intent from empty input');
  }

  const dryRun = Boolean(options.dryRun);
  if (dryRun) {
    return extractIntentDeterministic(text, metadata);
  }

  const health = await checkOllamaHealth(options);
  if (!health.available) {
    return extractIntentDeterministic(text, metadata);
  }

  const model = options.model || health.selectedModel || 'qwen2.5:latest';
  const systemPrompt = `You are a zero-token local intent extraction engine for an autonomous engineering system.
Convert the unstructured user message into a strict, validated JSON action card matching this schema:
{
  "id": "act-<timestamp>-<rand>",
  "timestamp": "<ISO-8601>",
  "source": "${metadata.source || 'mobile-voice'}",
  "action_type": "deterministic_fix" | "antigravity_triage",
  "intent": "remediate_quarantine_enobufs" | "prune_dead_sources" | "consolidate_pack" | "triage_mobile_request" | "investigate_ci_failure",
  "priority": "P1" | "P2" | "P3",
  "target_notebook_name": "<string or null>",
  "summary": "<concise 1-sentence summary>",
  "execution_plan": [
    { "step": 1, "handler": "ironbot" | "antigravity", "action": "<action_name>", "command": "<optional cli command>" }
  ],
  "context": {}
}
Respond with raw JSON only. No markdown fences. No explanations.`;

  try {
    const res = await queryOllama('/api/generate', {
      model,
      system: systemPrompt,
      prompt: `Input message:\n${text}`,
      stream: false,
      options: {
        temperature: 0.1
      }
    }, options);

    const rawResponse = (res && res.response) ? res.response.trim() : '';
    const cleanJson = rawResponse.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
    const parsed = JSON.parse(cleanJson);

    // Validate required fields
    if (parsed.action_type && parsed.intent) {
      return {
        ...parsed,
        id: parsed.id || `act-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        timestamp: parsed.timestamp || new Date().toISOString(),
        source: metadata.source || parsed.source || 'mobile-voice',
        context: {
          ...(parsed.context || {}),
          provider: `ollama:${model}`,
          raw_input: text
        }
      };
    }
  } catch {
    // LLM parsing failed or malformed JSON; fall back gracefully
  }

  return extractIntentDeterministic(text, metadata);
}

/**
 * Fallback deterministic stack trace summarizer.
 */
export function summarizeStackTraceDeterministic(rawLog) {
  const log = String(rawLog || '').trim();
  const lines = log.split(/\r?\n/);

  let failureType = 'GenericError';
  let failureLocation = 'unknown';
  let errorMessage = 'Build or test failed without explicit assertion message';

  for (const line of lines) {
    // Check for AssertionError / TypeError / SyntaxError / Error:
    const errMatch = line.match(/(?:(?:AssertionError|TypeError|SyntaxError|Error|ReferenceError|RangeError):\s*(.+))/i);
    if (errMatch) {
      errorMessage = errMatch[1].trim();
      failureType = line.split(':')[0].trim();
      break;
    }
    // Check for process completed with exit code
    if (/Process completed with exit code (\d+)/i.test(line)) {
      errorMessage = line.trim();
      failureType = 'ProcessExitError';
    }
  }

  for (const line of lines) {
    const atMatch = line.match(/at\s+(?:.*?\s+\()?([A-Za-z0-9_\-./\\:]+:\d+:\d+)\)?/);
    if (atMatch) {
      failureLocation = atMatch[1];
      break;
    }
  }

  return {
    provider: 'deterministic_fallback',
    failureType,
    failureLocation,
    errorMessage,
    rootCause: `[${failureType}] in ${failureLocation}: ${errorMessage}`
  };
}

/**
 * Summarize CI stack trace with local small model or deterministic fallback.
 */
export async function summarizeCiStackTrace(rawLog, context = {}, options = {}) {
  const log = String(rawLog || '').trim();
  if (!log) {
    return { provider: 'none', rootCause: 'Empty log stream provided' };
  }

  const dryRun = Boolean(options.dryRun);
  if (dryRun) {
    return summarizeStackTraceDeterministic(log);
  }

  const health = await checkOllamaHealth(options);
  if (!health.available) {
    return summarizeStackTraceDeterministic(log);
  }

  const model = options.model || health.selectedModel || 'qwen2.5:latest';
  const prompt = `Analyze this CI failure snippet. Identify the failure type, failing file/line, and root cause in 1-2 sentences. Output JSON only:
{
  "failureType": "<type>",
  "failureLocation": "<file:line>",
  "errorMessage": "<exact error>",
  "rootCause": "<1-2 sentence explanation and suggested fix>"
}

CI Log:
${log.slice(-3000)}`;

  try {
    const res = await queryOllama('/api/generate', {
      model,
      prompt,
      stream: false,
      options: { temperature: 0.1 }
    }, options);

    const rawResponse = (res && res.response) ? res.response.trim() : '';
    const cleanJson = rawResponse.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
    const parsed = JSON.parse(cleanJson);
    if (parsed.rootCause) {
      return {
        provider: `ollama:${model}`,
        ...parsed
      };
    }
  } catch {}

  return summarizeStackTraceDeterministic(log);
}

// CLI Execution
if (process.argv[1] && path.resolve(process.argv[1]) === import.meta.filename) {
  const args = process.argv.slice(2);
  const isHealth = args.includes('--health');
  const intentIdx = args.findIndex(a => a === '--intent');
  const traceIdx = args.findIndex(a => a === '--trace-file');

  (async () => {
    if (isHealth) {
      const h = await checkOllamaHealth();
      console.log(JSON.stringify(h, null, 2));
      process.exit(h.available ? 0 : 1);
    }

    if (intentIdx !== -1 && args[intentIdx + 1]) {
      const res = await extractMobileIntent(args[intentIdx + 1], { source: 'cli' });
      console.log(JSON.stringify(res, null, 2));
      process.exit(0);
    }

    if (traceIdx !== -1 && args[traceIdx + 1]) {
      const tracePath = path.resolve(args[traceIdx + 1]);
      if (!fs.existsSync(tracePath)) {
        console.error(`Error: Trace file not found at ${tracePath}`);
        process.exit(1);
      }
      const trace = fs.readFileSync(tracePath, 'utf8');
      const res = await summarizeCiStackTrace(trace);
      console.log(JSON.stringify(res, null, 2));
      process.exit(0);
    }

    console.log('Usage: local-small-model-bridge.mjs [--health | --intent "<text>" | --trace-file <path>]');
  })();
}
