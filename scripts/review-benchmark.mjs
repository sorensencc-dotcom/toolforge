#!/usr/bin/env node
/**
 * Compares false-positive and false-negative rates for single-model and cross-model adversarial review
 * on the labeled fixture diffs. Calls real reviewer models, so it needs OPENAI_API_KEY and ANTHROPIC_API_KEY.
 * Non-blocking by design: it reports rates and never fails on them. Exits 2 only when no case could be scored.
 *
 * Usage: node scripts/review-benchmark.mjs [--cases <file>] [--threshold <n>] [--json]
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import {
  crossFamilyRoute,
  formatBenchmark,
  runReviewBenchmark,
  sameFamilyRoute,
} from '../modules/review/review-benchmark.ts';
import { resolveReviewerProvider } from '../modules/review/routing.ts';

const { values } = parseArgs({
  options: {
    cases: { type: 'string', default: fileURLToPath(new URL('../tests/fixtures/review-benchmark/cases.json', import.meta.url)) },
    threshold: { type: 'string' },
    json: { type: 'boolean', default: false },
  },
});

const cases = JSON.parse(readFileSync(values.cases, 'utf8'));
const providers = new Map();
// One provider per route, so each key is read and validated once.
const resolveProvider = (route) => {
  const key = `${route.provider}/${route.model}`;
  if (!providers.has(key)) providers.set(key, resolveReviewerProvider(route));
  return providers.get(key);
};

const summaries = await runReviewBenchmark(
  cases,
  [
    { mode: 'single-model', routeFor: sameFamilyRoute, resolveProvider },
    { mode: 'cross-model', routeFor: crossFamilyRoute, resolveProvider },
  ],
  values.threshold === undefined ? {} : { threshold: Number(values.threshold) },
);

console.log(values.json ? JSON.stringify(summaries, null, 2) : formatBenchmark(summaries));
process.exit(summaries.every((s) => s.errors === s.results.length) ? 2 : 0);
