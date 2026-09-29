/**
 * scripts/claude-compactor.test.mjs
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { compactTranscript } from './claude-compactor.mjs';

test('compactTranscript drops stale tool results, writes tombstones, and spills to disk', async () => {
  const tmpSpillDir = path.join(os.tmpdir(), `test-spills-${Date.now()}`);

  const mockFetch = async () => {
    return {
      ok: true,
      json: async () => ({
        answers: {
          keep: {
            noul: 0.1, // Below threshold 0.5 -> drop
          },
        },
      }),
    };
  };

  const sampleMessages = [
    {
      role: 'user',
      text: 'Run the tests',
      toolUses: [],
    },
    {
      role: 'assistant',
      text: 'Running test harness...',
      toolUses: [{ tool_use_id: 'tool_1', tool: 'bash', input: { command: 'npm test' } }],
    },
    {
      role: 'user',
      text: '',
      toolUses: [],
      toolResults: [
        {
          tool_use_id: 'tool_1',
          text: 'PASS test/1.js\nPASS test/2.js\n' + 'long verbose trace '.repeat(50),
        },
      ],
    },
    { role: 'user', text: 'Recent message 1' },
    { role: 'assistant', text: 'Recent message 2' },
    { role: 'user', text: 'Recent message 3' },
    { role: 'assistant', text: 'Recent message 4' },
  ];

  const result = await compactTranscript(sampleMessages, {
    fetchImpl: mockFetch,
    spillDir: tmpSpillDir,
    keepThreshold: 0.5,
    preserveRecentMessages: 4,
  });

  assert.equal(result.stats.droppedTools, 1);
  assert.equal(result.stats.spilledCount, 1);
  assert.equal(result.stats.originalCount, 7);
  assert.equal(result.stats.compactedCount, 7);

  // Check tombstone text exists on the toolResult
  const tombstone = result.messages[2].toolResults[0];
  assert.equal(tombstone.tool_use_id, 'tool_1');
  assert.match(tombstone.text, /output omitted .* spilled to disk/);

  // Verify spilled file exists
  const files = await fs.readdir(tmpSpillDir);
  assert.equal(files.length, 1);
  const spilledJson = JSON.parse(await fs.readFile(path.join(tmpSpillDir, files[0]), 'utf-8'));
  assert.equal(spilledJson.tool_use_id, 'tool_1');

  // Clean up
  await fs.rm(tmpSpillDir, { recursive: true, force: true });
});

test('compactTranscript fails open if Jev is unreachable', async () => {
  const mockFetchFail = async () => {
    throw new Error('ECONNREFUSED');
  };

  const sampleMessages = [
    {
      role: 'user',
      text: '',
      toolUses: [],
      toolResults: [
        {
          tool_use_id: 'tool_99',
          text: 'Critical error trace '.repeat(50),
        },
      ],
    },
    { role: 'user', text: 'Recent 1' },
  ];

  const result = await compactTranscript(sampleMessages, {
    fetchImpl: mockFetchFail,
    preserveRecentMessages: 1,
  });

  // Retained fail-open
  assert.equal(result.stats.droppedTools, 0);
  assert.equal(result.messages[0].toolResults.length, 1);
  assert.doesNotMatch(result.messages[0].toolResults[0].text, /output omitted/);
});
