import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  crossFamilyRoute,
  formatBenchmark,
  runReviewBenchmark,
  sameFamilyRoute,
  type BenchmarkArm,
  type BenchmarkCase,
} from './review-benchmark.ts';
import type { LocalProviderLike } from '../../src/providers/index.js';

const CASES = JSON.parse(
  readFileSync(new URL('../../tests/fixtures/review-benchmark/cases.json', import.meta.url), 'utf8'),
) as BenchmarkCase[];

const finding = (likelihood: number, cost: number) =>
  JSON.stringify({
    findings: [{ id: 'F1', file: 'x.ts', summary: 'Race', trigger: 'Concurrent calls under load', likelihood, cost, fixRecipe: 'Lock it' }],
    noise: [],
  });
const CLEAN = JSON.stringify({ findings: [], noise: [] });

/** Replies by case id, found through the id the fixture diff carries in its file path. */
function scripted(replyFor: (item: BenchmarkCase) => string): LocalProviderLike {
  return {
    async generate(_model, prompt) {
      const item = CASES.find((c) => prompt.includes(c.diff));
      if (item === undefined) throw new Error('prompt matched no fixture');
      return replyFor(item);
    },
  };
}

const arm = (mode: BenchmarkArm['mode'], provider: LocalProviderLike): BenchmarkArm => ({
  mode,
  routeFor: mode === 'single-model' ? sameFamilyRoute : crossFamilyRoute,
  resolveProvider: () => provider,
});

describe('benchmark corpus', () => {
  it('covers bug, clean, and bait diffs with unique ids', () => {
    assert.deepEqual([...new Set(CASES.map((c) => c.label))].sort(), ['bait', 'bug', 'clean']);
    assert.equal(new Set(CASES.map((c) => c.id)).size, CASES.length);
  });

  it('gives every case an author the matrix can route', () => {
    for (const c of CASES) {
      assert.doesNotThrow(() => crossFamilyRoute(c.authorModel), c.id);
      assert.doesNotThrow(() => sameFamilyRoute(c.authorModel), c.id);
    }
  });
});

describe('routes', () => {
  it('puts the single-model arm in the author family and the cross-model arm outside it', () => {
    assert.equal(sameFamilyRoute('claude-opus-5-5').provider, 'anthropic');
    assert.equal(crossFamilyRoute('claude-opus-5-5').provider, 'openai');
    assert.equal(sameFamilyRoute('gpt-6.1-sol').provider, 'openai');
    assert.equal(crossFamilyRoute('gpt-6.1-sol').provider, 'anthropic');
  });

  it('fails closed on an unknown author', () => {
    assert.throws(() => sameFamilyRoute('mystery-1'), /No same-family reviewer/);
  });
});

describe('runReviewBenchmark', () => {
  it('counts false positives on clean and bait diffs and false negatives on bug diffs', async () => {
    // Over-eager reviewer: blocks everything except the concurrency bug.
    const eager = scripted((c) => (c.id === 'bug-concurrent-counter' ? CLEAN : finding(0.9, 9)));
    // Calibrated reviewer: blocks exactly the bug diffs.
    const calibrated = scripted((c) => (c.label === 'bug' ? finding(0.9, 9) : CLEAN));

    const [single, cross] = await runReviewBenchmark(CASES, [arm('single-model', eager), arm('cross-model', calibrated)]);

    assert.equal(single.falsePositives, 4);
    assert.equal(single.falsePositiveRate, 1);
    assert.equal(single.falseNegatives, 1);
    assert.equal(single.falseNegativeRate, 0.5);
    assert.equal(cross.falsePositives, 0);
    assert.equal(cross.falsePositiveRate, 0);
    assert.equal(cross.falseNegatives, 0);
  });

  it('keeps errors and malformed replies out of both rates', async () => {
    const broken = scripted((c) => {
      if (c.id === 'clean-rename') throw new Error('Missing OPENAI_API_KEY for secondary reviewer in dispatch matrix');
      if (c.id === 'clean-docs') return 'not json';
      return c.label === 'bug' ? finding(0.9, 9) : CLEAN;
    });
    const [summary] = await runReviewBenchmark(CASES, [arm('cross-model', broken)]);

    assert.equal(summary.errors, 2);
    assert.equal(summary.falsePositives, 0);
    assert.equal(summary.falsePositiveRate, 0);
    assert.match(summary.results.find((r) => r.caseId === 'clean-rename')?.error ?? '', /Missing OPENAI_API_KEY/);
  });

  it('honors the pass threshold', async () => {
    const mild = scripted(() => finding(0.5, 4)); // risk 2
    const [lenient] = await runReviewBenchmark(CASES, [arm('single-model', mild)]);
    const [strict] = await runReviewBenchmark(CASES, [arm('single-model', mild)], { threshold: 1 });

    assert.equal(lenient.falsePositives, 0);
    assert.equal(strict.falsePositives, 4);
  });

  it('reports a null rate when the corpus has no case of that kind', async () => {
    const bugsOnly = CASES.filter((c) => c.label === 'bug');
    const [summary] = await runReviewBenchmark(bugsOnly, [arm('cross-model', scripted(() => CLEAN))]);

    assert.equal(summary.falsePositiveRate, null);
    assert.equal(summary.falseNegativeRate, 1);
  });

  it('sends the same prompt to both arms', async () => {
    const seen: string[][] = [[], []];
    const spy = (i: number): LocalProviderLike => ({
      async generate(_model, prompt) {
        seen[i].push(prompt);
        return CLEAN;
      },
    });
    await runReviewBenchmark(CASES, [arm('single-model', spy(0)), arm('cross-model', spy(1))]);
    assert.deepEqual(seen[0], seen[1]);
  });
});

describe('per-case routing', () => {
  it('routes each case by its own author and records the reviewer used', async () => {
    const [summary] = await runReviewBenchmark(CASES, [arm('cross-model', scripted(() => CLEAN))]);
    const byId = Object.fromEntries(summary.results.map((r) => [r.caseId, r.reviewer]));
    assert.equal(byId['clean-rename'], 'openai/gpt-6.1-sol');
    assert.equal(byId['clean-docs'], 'anthropic/claude-opus-5-5');
  });

  it('records an unroutable author as an error, not a pass', async () => {
    const bad: BenchmarkCase[] = [{ ...CASES[0], authorModel: 'mystery-1' }];
    const [summary] = await runReviewBenchmark(bad, [arm('cross-model', scripted(() => CLEAN))]);
    assert.equal(summary.errors, 1);
    assert.equal(summary.falsePositiveRate, null);
  });
});

describe('formatBenchmark', () => {
  it('lists each error under its mode', async () => {
    const failing = scripted(() => {
      throw new Error('Missing OPENAI_API_KEY for secondary reviewer in dispatch matrix');
    });
    const out = formatBenchmark(await runReviewBenchmark(CASES.slice(0, 1), [arm('cross-model', failing)]));
    assert.match(out, /errors 1\n {2}error clean-rename: Missing OPENAI_API_KEY/);
  });

  it('prints one line per mode with percentages', async () => {
    const summaries = await runReviewBenchmark(CASES, [arm('cross-model', scripted(() => CLEAN))]);
    assert.match(formatBenchmark(summaries), /^cross-model \(openai\/gpt-6\.1-sol, anthropic\/claude-opus-5-5\): false positives 0 \(0\.0%\), false negatives 2 \(100\.0%\), errors 0$/);
  });
});
