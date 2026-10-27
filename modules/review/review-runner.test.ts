import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildReviewPrompt, runAdversarialReview } from './review-runner.ts';
import { ReviewRoutingError } from './routing.ts';
import type { LocalProviderLike } from '../../src/providers/index.js';

const DIFF = 'diff --git a/x.ts b/x.ts\n+let shared = 0;\n';

function mockProvider(reply: string) {
  const calls: { model: string; prompt: string }[] = [];
  const provider: LocalProviderLike = {
    async generate(model, prompt) {
      calls.push({ model, prompt });
      return reply;
    },
  };
  return { provider, calls };
}

const finding = (over: Record<string, unknown> = {}) => ({
  id: 'F1',
  file: 'x.ts',
  summary: 'Two workers race on the shared counter',
  trigger: 'Two requests increment concurrently under production load',
  likelihood: 0.6,
  cost: 8,
  fixRecipe: 'Guard the counter with a mutex',
  ...over,
});

describe('buildReviewPrompt', () => {
  const prompt = buildReviewPrompt({ diff: DIFF, commitMessage: 'feat: add counter' });

  it('includes the diff and commit message as data', () => {
    assert.ok(prompt.includes(DIFF));
    assert.ok(prompt.includes('feat: add counter'));
  });

  it('requires the ReviewResult JSON fields and nothing else', () => {
    for (const field of ['findings', 'noise', 'trigger', 'likelihood', 'cost', 'fixRecipe', 'whyHypothetical']) {
      assert.ok(prompt.includes(field), field);
    }
    assert.match(prompt, /at most 7/i);
    assert.match(prompt, /only (valid )?JSON/i);
  });

  it('tells the model not to supply risk', () => {
    assert.match(prompt, /do not (supply|include|compute) (a )?risk/i);
  });

  it('forbids recommending extra defensive code', () => {
    assert.match(prompt, /defensive/i);
  });
});

describe('runAdversarialReview', () => {
  it('passes a clean diff (spec test 1)', async () => {
    const { provider, calls } = mockProvider('{"findings": [], "noise": []}');
    const result = await runAdversarialReview(
      { diff: DIFF, packet: { author_model: 'claude-opus-5-5' } },
      { resolveProvider: () => provider },
    );
    assert.equal(result.outcome.pass, true);
    assert.deepEqual(result.route, { provider: 'openai', model: 'gpt-6.1-sol' });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].model, 'gpt-6.1-sol');
    assert.ok(calls[0].prompt.includes(DIFF));
  });

  it('fails a high-risk finding with a trigger and fix recipe (spec test 2)', async () => {
    const { provider } = mockProvider(JSON.stringify({ findings: [finding({ risk: 0 })], noise: [] }));
    const { outcome } = await runAdversarialReview(
      { diff: DIFF, packet: { author_model: 'claude-opus-5-5' } },
      { resolveProvider: () => provider },
    );
    assert.equal(outcome.pass, false);
    assert.equal(outcome.findings[0].risk, 4.8);
    assert.ok(outcome.findings[0].fixRecipe.length > 0);
  });

  it('honors a threshold override', async () => {
    const { provider } = mockProvider(JSON.stringify({ findings: [finding()], noise: [] }));
    const { outcome } = await runAdversarialReview(
      { diff: DIFF, packet: { author_model: 'claude-opus-5-5' }, threshold: 9 },
      { resolveProvider: () => provider },
    );
    assert.equal(outcome.pass, true);
  });

  it('fails closed on malformed reviewer output', async () => {
    const { provider } = mockProvider('not json');
    const { outcome } = await runAdversarialReview(
      { diff: DIFF, packet: { author_model: 'claude-opus-5-5' } },
      { resolveProvider: () => provider },
    );
    assert.equal(outcome.pass, false);
    assert.deepEqual(outcome.flags, ['malformed']);
  });

  it('rejects before any provider call when the author is unknown', async () => {
    let resolved = false;
    await assert.rejects(
      runAdversarialReview({ diff: DIFF, packet: {} }, { resolveProvider: () => ((resolved = true), mockProvider('').provider) }),
      ReviewRoutingError,
    );
    assert.equal(resolved, false);
  });

  it('propagates a provider failure instead of passing', async () => {
    const provider: LocalProviderLike = {
      async generate() {
        throw new Error('HTTP 500');
      },
    };
    await assert.rejects(
      runAdversarialReview({ diff: DIFF, packet: { author_model: 'claude-opus-5-5' } }, { resolveProvider: () => provider }),
      { message: 'HTTP 500' },
    );
  });

  it('routes a GPT author to the Claude reviewer', async () => {
    const { provider, calls } = mockProvider('{"findings": [], "noise": []}');
    await runAdversarialReview({ diff: DIFF, packet: { author_model: 'gpt-6.1-sol' } }, { resolveProvider: () => provider });
    assert.equal(calls[0].model, 'claude-opus-5-5');
  });
});
