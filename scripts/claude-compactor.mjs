/**
 * scripts/claude-compactor.mjs
 *
 * Sub-Second Agent Context & Tool-Call Compaction using local Jev/Ollama scoring.
 * Evaluates session transcripts, prunes stale tool calls/results, preserves conversational
 * turns verbatim, and optionally spills dropped tool traces to .kb_cache/spills.
 */

import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_JEV_URL = process.env.JEV_BASE_URL || 'http://127.0.0.1:4173/v1/systemone';
const DEFAULT_SPILL_DIR = path.resolve(process.cwd(), '.kb_cache/spills');

/**
 * Compact transcript messages using local Jev scoring
 *
 * @param {Array<Object>} messages Session messages [{role, text, toolUses, toolResults}]
 * @param {Object} options
 * @param {string} [options.baseUrl] Jev / SystemOne endpoint
 * @param {number} [options.keepThreshold] Minimum score to retain tool results (default 0.5)
 * @param {number} [options.preserveRecentMessages] Number of recent messages to never touch (default 4)
 * @param {number} [options.truncateHeadChars] Chars to preserve in tombstone before note (default 120)
 * @param {string} [options.spillDir] Directory to write dropped tool traces to
 * @param {Function} [options.fetchImpl] Custom fetch for testing/mocking
 * @returns {Promise<{messages: Array<Object>, stats: Object, decisions: Array<Object>}>}
 */
export async function compactTranscript(messages, options = {}) {
  const {
    baseUrl = DEFAULT_JEV_URL,
    keepThreshold = 0.5,
    preserveRecentMessages = 4,
    truncateHeadChars = 120,
    spillDir = DEFAULT_SPILL_DIR,
    fetchImpl = globalThis.fetch,
  } = options;

  if (!Array.isArray(messages) || messages.length === 0) {
    return {
      messages: messages || [],
      stats: { originalCount: 0, compactedCount: 0, droppedTools: 0, spilledCount: 0 },
      decisions: [],
    };
  }

  const decisions = [];
  let droppedTools = 0;
  let spilledCount = 0;

  // Identify tool results that can be evaluated (excluding protected recent messages)
  const cutoffIndex = Math.max(0, messages.length - preserveRecentMessages);
  const clonedMessages = structuredClone(messages);

  for (let i = 0; i < cutoffIndex; i++) {
    const msg = clonedMessages[i];
    if (msg.toolResults && Array.isArray(msg.toolResults) && msg.toolResults.length > 0) {
      // Evaluate all toolResults in the message concurrently
      const evaluations = await Promise.all(
        msg.toolResults.map(async (res) => {
          const toolUseId = res.tool_use_id || res.id || 'unknown';
          const rawContent =
            typeof res === 'string'
              ? res
              : res.text || res.content || (typeof res.output === 'string' ? res.output : JSON.stringify(res));

          // Skip scoring tiny results (< 200 chars)
          if (typeof rawContent === 'string' && rawContent.length < 200) {
            return { res, keepScore: 1.0, toolUseId, rawContent, evaluated: false };
          }

          let keepScore = 1.0;
          try {
            const response = await fetchImpl(baseUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                state: {
                  current_goal: 'Analyze and compact session history',
                  tool_use_id: toolUseId,
                  preview: typeof rawContent === 'string' ? rawContent.slice(0, 500) : '',
                },
                questions: {
                  keep: {
                    type: 'noul',
                    instructions: 'Is this tool output strictly required for the ongoing session context?',
                  },
                },
              }),
            });

            if (response.ok) {
              const data = await response.json();
              if (data.answers?.keep?.noul !== undefined) {
                keepScore = data.answers.keep.noul;
              }
            }
          } catch {
            // Fail-open on network or parse errors
            keepScore = 1.0;
          }

          return { res, keepScore, toolUseId, rawContent, evaluated: true };
        })
      );

      const processedResults = [];

      for (const item of evaluations) {
        const { res, keepScore, toolUseId, rawContent, evaluated } = item;

        if (evaluated) {
          decisions.push({
            tool_use_id: toolUseId,
            score: keepScore,
            retained: keepScore >= keepThreshold,
          });
        }

        if (keepScore >= keepThreshold) {
          processedResults.push(res);
        } else {
          // Attempt spill if spillDir is configured
          let spillFailed = false;
          if (spillDir) {
            try {
              await fs.mkdir(spillDir, { recursive: true });
              const uniqueSuffix = crypto.randomUUID().slice(0, 8);
              const spillPath = path.join(spillDir, `spill-${Date.now()}-${uniqueSuffix}-${toolUseId}.json`);
              await fs.writeFile(
                spillPath,
                JSON.stringify({ tool_use_id: toolUseId, content: rawContent }, null, 2),
                'utf-8'
              );
              spilledCount++;
            } catch (err) {
              console.error(`[Compactor] Warning: failed to spill dropped tool trace, retaining original trace: ${err.message}`);
              spillFailed = true;
            }
          }

          if (spillFailed) {
            // Retain original trace on spill failure to avoid permanent audit data loss
            processedResults.push(res);
          } else {
            droppedTools++;
            // Build tombstone note preserving tool_use pairing without bloating context
            const headPreview =
              typeof rawContent === 'string' && truncateHeadChars > 0
                ? `${rawContent.slice(0, truncateHeadChars)}...\n`
                : '';
            const tombstoneText = `${headPreview}[output omitted (${rawContent.length} chars); spilled to disk]`;

            const tombstonedResult =
              typeof res === 'object' && res !== null
                ? { ...res, text: tombstoneText }
                : { tool_use_id: toolUseId, text: tombstoneText };

            processedResults.push(tombstonedResult);
          }
        }
      }

      msg.toolResults = processedResults;
    }
  }

  return {
    messages: clonedMessages,
    stats: {
      originalCount: messages.length,
      compactedCount: clonedMessages.length,
      droppedTools,
      spilledCount,
    },
    decisions,
  };
}

// CLI Execution Support
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const args = process.argv.slice(2);
  const inputArg = args.find((a) => !a.startsWith('--'));
  const thresholdArg = args.find((a) => a.startsWith('--threshold='));
  const keepThreshold = thresholdArg ? parseFloat(thresholdArg.split('=')[1]) : 0.5;

  let inputData = '';
  if (inputArg) {
    inputData = await fs.readFile(path.resolve(inputArg), 'utf-8');
  } else {
    process.stdin.setEncoding('utf-8');
    for await (const chunk of process.stdin) {
      inputData += chunk;
    }
  }

  if (!inputData.trim()) {
    console.error('Usage: node scripts/claude-compactor.mjs [transcript.json] [--threshold=0.5]');
    process.exit(1);
  }

  try {
    const messages = JSON.parse(inputData);
    const result = await compactTranscript(Array.isArray(messages) ? messages : messages.messages || [], {
      keepThreshold,
    });
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    console.error(`Error during compaction: ${err.message}`);
    process.exit(1);
  }
}
