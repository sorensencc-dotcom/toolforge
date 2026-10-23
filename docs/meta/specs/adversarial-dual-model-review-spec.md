# Adversarial dual-model review and rank-by-risk spec

Status: APPROVED (Tier 1, 2026-10-23). Implementation not started.
Source: [issue 191](https://github.com/sorensencc-dotcom/toolforge/issues/191). Upstream card: TRM `ACT-01`, Drive file `1DDMvsBbL-M90LdMHBiMaZafiZz86kwOO6R9B_UrRvSw` (`2026-10-15T124801Z__action__toolforge__act-01-adversarial-dual-model-review.md`), priority HIGH, Sprint 35.
Date: 2026-10-22
Revision: 2. Replaces the first draft, whose defaults were guesses made before the card was found.

## Problem

Agent-authored diffs share blind spots with the model that wrote them. An unconstrained adversarial reviewer fixates on rare edge cases and pushes toward defensive boilerplate. Toolforge needs a pre-merge review that uses a different model family than the author and forces ranked, condition-backed findings.

## Decisions

These answer the five questions from the readiness review. Each comes from the ACT-01 card unless marked "design".

| # | Question | Decision |
|---|---|---|
| D1 | Dual-model meaning | Author-aware dispatch. A diff written by a Claude model goes to an OpenAI model (GPT-6.1 Sol), and the reverse. Scope is pre-merge diff review, not post-failure gate packets. |
| D2 | What is ranked | Candidate flaws found in a proposed diff, given the diff, PR description, and task context. At most 7. Confirmed bugs are separated from hypothetical noise. |
| D3 | Risk formula | `risk = likelihood x cost`. Likelihood is the chance of occurring under production workloads. Cost is blast radius. Each finding states the concrete trigger condition. |
| D4 | Routing | Design: add an author-aware routing policy that reads `author_model` from the commit or PR packet and picks the complementary provider from a configured matrix. |
| D5 | Pass | Design: pass when no finding exceeds a configured `risk` threshold. The card gives no threshold value. |

## Existing code

- `modules/healing/adversarial-auditor.ts` is a single-model post-failure auditor, with a `.js` duplicate. Do not add a third copy. Fold the shared parse and validate logic into one module and keep the existing `AuditVerdict` callers working.
- `src/providers/index.js` `getProvider()` is a cached singleton that returns only an Ollama provider. A GPT-6.1 Sol reviewer needs a second provider implementation behind the same `generate(model, prompt)` interface. Routing cannot be built on `getProvider()` alone.
- `modules/ticket-scorer` scores ticket text. It is not reused here.

## Behavior

### CLI

- Add `toolforge review --adversarial` to the commit and PR generation workflows.
- No `review-adversarial` alias. The card names both forms and the operator chose the flag form.

### Dispatch

`selectReviewer(packet, matrix)` reads `packet.author_model` and returns the complementary provider.

- Default matrix: `claude-*` maps to `gpt-6.1-sol`, and `gpt-*` maps to a Claude model.
- Unknown or missing `author_model` fails closed with a clear error. Do not guess a reviewer.

### Prompt contract

The reviewer prompt must require this JSON and nothing else.

```ts
interface ReviewResult {
  findings: Finding[]; // length <= 7, sorted by risk descending
  noise: NoiseItem[];  // hypothetical issues, never counted toward pass
}

interface Finding {
  id: string;
  file: string;
  summary: string;
  trigger: string;     // concrete production condition, required
  likelihood: number;  // 0..1
  cost: number;        // 1..10 blast radius
  risk: number;        // likelihood * cost, computed by Toolforge, not the model
  fixRecipe: string;
}

interface NoiseItem {
  summary: string;
  whyHypothetical: string;
}
```

Toolforge computes `risk` and the sort order itself. The model supplies `likelihood` and `cost` only.

### Validation

- More than 7 findings: keep the 7 highest by `risk` and add a flag.
- Finding without `trigger`: move it to `noise`.
- Malformed JSON: fail closed with no findings and a `malformed` flag.

### Over-validation circuit breaker

Suppress a finding and record it under `suppressed` when its summary or fix recipe mainly recommends added defensive code. Detection is deterministic: match on patterns such as extra null or nil checks, redundant input validation of internal types, and new guard layers, combined with a low `likelihood`. The exact rule list is an open item.

### Pass

`pass` is true when no remaining finding has `risk` at or above `threshold`. The threshold lives in config. `noise` and `suppressed` never block.

## Test contract

Replace the placeholder in `tests/trm-act-01-adversarial-dual-model-review.test.mjs`. Use mock providers, no network, and three fixture diffs.

1. Clean diff: reviewer returns no findings. `pass` is true.
2. High-risk concurrency bug: reviewer returns one finding above threshold with a trigger. `pass` is false and a `fixRecipe` is present.
3. Boilerplate-bait diff: reviewer recommends redundant validation. The finding is suppressed and `pass` is true.
4. Output never exceeds 7 findings and is sorted by descending `risk`.
5. A finding without `trigger` lands in `noise`.
6. Toolforge recomputes `risk`. A model-supplied `risk` value is ignored.
7. Claude author routes to the GPT provider, and the reverse. Missing `author_model` fails closed.
8. Malformed reviewer JSON fails closed.

Run with `timeout 60 node --test`.

Benchmark, as a separate non-blocking deliverable: compare false-positive rates for single-model and cross-model passes in the Antigravity suites. The card asks for it and does not give a pass bar.

## Delivery order

1. Types, `risk` computation, ranking, cap, and validation (tests 4 to 6, 8). No provider code.
2. Circuit breaker (test 3).
3. Routing and the second provider implementation (test 7). Needs the credentials decision below.
4. Prompt template and `toolforge review --adversarial` wiring (tests 1 and 2).
5. Merge the `.js` and `.ts` auditor logic. Find callers first with `graft callers runAdversarialCrossAudit`.
6. Benchmark in the Antigravity suites.

## Resolved items

Resolved 2026-10-22 by the operator. Items 1, 2, 3, and 5 accepted the proposed defaults.

1. CLI: `toolforge review --adversarial` only. No `review-adversarial` alias.
2. Pass threshold: `risk >= 3` blocks, with likelihood 0 to 1 and cost 1 to 10. Configurable.
3. `author_model` comes from a `Co-Authored-By` trailer or a field in the commit or PR packet. Missing value fails closed.
4. Credentials: `OPENAI_API_KEY`, with fallback to `TOOLFORGE_OPENAI_API_KEY`, read from the repo-root `.env` or the system environment, matching the `kb-sync` convention. When the dispatch matrix needs the secondary reviewer and no key is set, fail fast with `Missing OPENAI_API_KEY for secondary reviewer in dispatch matrix`. Never fall back silently to single-model review.
5. Circuit breaker: suppress findings that recommend extra null checks, validation of internal types, or new guard layers when `likelihood < 0.1`.
6. Task ingestion: `scripts/trm-ingest-drive.mjs`, run in `C:\dev\kb-sync`, writes the full ACT-01 payload to `.harness/tasks/pending/act-01-adversarial-dual-model-review.md`. Not yet run.

## Remaining open items

None blocking. Approval is the only gate left.

## Approval

Tier 1 approval: granted by the operator in chat, 2026-10-23. Scope: this spec, revision 2, with decisions D1 to D5 and resolved items 1 to 6.
