import type { LocalProviderLike } from '../../src/providers/index.js';
import { parseReview } from './adversarial-review.ts';
import { buildReviewPrompt } from './review-runner.ts';
import { selectReviewer, type ReviewerRoute } from './routing.ts';

/** `bug` diffs hold a real defect the reviewer should block. `clean` and `bait` diffs should pass. */
export type BenchmarkLabel = 'bug' | 'clean' | 'bait';

export interface BenchmarkCase {
  readonly id: string;
  readonly label: BenchmarkLabel;
  readonly authorModel: string;
  readonly commitMessage: string;
  readonly diff: string;
}

export type BenchmarkMode = 'single-model' | 'cross-model';

export interface BenchmarkArm {
  readonly mode: BenchmarkMode;
  /** Picks the reviewer for a case, so one arm can cover authors from different families. */
  readonly routeFor: (authorModel: string) => ReviewerRoute;
  readonly resolveProvider: (route: ReviewerRoute) => LocalProviderLike;
}

export interface CaseResult {
  readonly caseId: string;
  readonly label: BenchmarkLabel;
  readonly reviewer: string;
  readonly blocked: boolean;
  readonly flags: readonly string[];
  readonly error?: string;
}

export interface ModeSummary {
  readonly mode: BenchmarkMode;
  /** Distinct reviewers used, in first-use order. */
  readonly reviewers: readonly string[];
  readonly results: readonly CaseResult[];
  readonly falsePositives: number;
  readonly falseNegatives: number;
  readonly errors: number;
  /** Blocked non-bug diffs over non-bug diffs. Null when the corpus has none. */
  readonly falsePositiveRate: number | null;
  /** Passed bug diffs over bug diffs. Null when the corpus has none. */
  readonly falseNegativeRate: number | null;
}

/** The reviewer a diff author would get without cross-family dispatch: a model from the author's own family. */
export function sameFamilyRoute(authorModel: string): ReviewerRoute {
  const author = authorModel.trim().toLowerCase();
  if (author.startsWith('claude-')) return { provider: 'anthropic', model: 'claude-opus-5-5' };
  if (author.startsWith('gpt-')) return { provider: 'openai', model: 'gpt-6.1-sol' };
  throw new Error(`No same-family reviewer for author model "${authorModel}".`);
}

export function crossFamilyRoute(authorModel: string): ReviewerRoute {
  return selectReviewer({ author_model: authorModel });
}

/**
 * Runs every case through every arm. A reviewer error counts as an error, not as a pass or a block,
 * so a missing key or a malformed reply cannot flatter an arm's false-positive rate.
 */
export async function runReviewBenchmark(
  cases: readonly BenchmarkCase[],
  arms: readonly BenchmarkArm[],
  { threshold }: { readonly threshold?: number } = {},
): Promise<readonly ModeSummary[]> {
  const summaries: ModeSummary[] = [];
  for (const arm of arms) {
    const results: CaseResult[] = [];
    for (const item of cases) {
      results.push(await reviewCase(item, arm, threshold));
    }
    summaries.push(summarize(arm, results));
  }
  return summaries;
}

async function reviewCase(item: BenchmarkCase, arm: BenchmarkArm, threshold: number | undefined): Promise<CaseResult> {
  const base = { caseId: item.id, label: item.label };
  let reviewer = '(unrouted)';
  try {
    const route = arm.routeFor(item.authorModel);
    reviewer = `${route.provider}/${route.model}`;
    const prompt = buildReviewPrompt({ diff: item.diff, commitMessage: item.commitMessage });
    const reply = await arm.resolveProvider(route).generate(route.model, prompt);
    const outcome = parseReview(reply, threshold === undefined ? undefined : { threshold });
    if (outcome.flags.includes('malformed')) {
      return { ...base, reviewer, blocked: false, flags: outcome.flags, error: 'Reviewer reply was malformed.' };
    }
    return { ...base, reviewer, blocked: !outcome.pass, flags: outcome.flags };
  } catch (e) {
    return { ...base, reviewer, blocked: false, flags: [], error: e instanceof Error ? e.message : String(e) };
  }
}

function summarize(arm: BenchmarkArm, results: readonly CaseResult[]): ModeSummary {
  const scored = results.filter(({ error }) => error === undefined);
  const nonBug = scored.filter(({ label }) => label !== 'bug');
  const bug = scored.filter(({ label }) => label === 'bug');
  const falsePositives = nonBug.filter(({ blocked }) => blocked).length;
  const falseNegatives = bug.filter(({ blocked }) => !blocked).length;
  return {
    mode: arm.mode,
    reviewers: [...new Set(results.map(({ reviewer }) => reviewer))],
    results,
    falsePositives,
    falseNegatives,
    errors: results.length - scored.length,
    falsePositiveRate: nonBug.length === 0 ? null : falsePositives / nonBug.length,
    falseNegativeRate: bug.length === 0 ? null : falseNegatives / bug.length,
  };
}

export function formatBenchmark(summaries: readonly ModeSummary[]): string {
  const pct = (rate: number | null): string => (rate === null ? 'n/a' : `${(rate * 100).toFixed(1)}%`);
  return summaries
    .flatMap((s) => [
      `${s.mode} (${s.reviewers.join(', ')}): false positives ${s.falsePositives} (${pct(s.falsePositiveRate)}), ` +
        `false negatives ${s.falseNegatives} (${pct(s.falseNegativeRate)}), errors ${s.errors}`,
      ...s.results.filter(({ error }) => error !== undefined).map((r) => `  error ${r.caseId}: ${r.error}`),
    ])
    .join('\n');
}
