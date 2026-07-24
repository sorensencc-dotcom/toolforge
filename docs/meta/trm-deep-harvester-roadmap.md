# TRM Deep Harvester — Future Roadmap (Outline Only)

**Status:** Unscheduled, no Tier 1 gate yet — nothing here executes. Captured
so the thinking survives without re-deriving it next time it comes up.
**Depends on:** `docs/superpowers/specs/2026-07-23-trm-research-questions-design.md`
(produces the `focus-areas.json` files this agent would consume).

## Purpose

An agent that consumes `focus-areas.json` across all TRM topics and runs deep,
iterative web queries per focus area — not single lookups like the
research-questions skill, but multi-hop research that follows leads across
searches. Self-expands its own search strategy based on what it finds.

## Inputs

- Per-topic `focus-areas.json` (from research-questions project).
- A future cross-topic rollup/index (not yet built — flagged as out of scope
  in the research-questions design).

## Self-learning loop (sketch)

Harvester logs which query strategies actually resolved past questions vs.
dead-ended. Biases future query generation toward strategies with higher
resolve-rate per theme-type (e.g. "photo provenance" themes respond well to
archive-site-scoped queries; "personnel" themes respond better to newspaper
archive queries — learned from outcomes, not hardcoded).

## Open questions for later

- Rate limiting / cost controls on deep queries (this could run unbounded
  without a cap).
- How self-learned search patterns get reviewed before trusted — curator
  gate? confidence threshold? Needs a decision before this ships.
- How `new_leads` surfaced by the research-questions skill get merged into
  this agent's queue vs. treated as a separate discovery stream.
- Where this agent lives (repo vs. standalone service) and how it's triggered
  (scheduled, on-demand, or reactive to new focus-area data).

## Explicit non-goals for this doc

No implementation. No schema lock. Just enough shape to resume the
conversation without re-litigating decisions already made here.

## Deferred from external review (2026-07-24)

An external review of the research-questions design (docs/superpowers/specs/
2026-07-23-trm-research-questions-design.md) proposed ~20 additions. The two
cheap/high-value ones (`deterministic_id`/`created_at` on questions, `llm`
provenance block in `research-questions.json`) were adopted immediately —
see `src/harvester/external/scan-gaps.mjs` and `skills/research-questions/SKILL.md`.
Everything else is deferred here, not rejected — revisit if/when the actual
pain shows up (this is a single-operator, manual-run, single-topic-at-a-time
tool right now; most of this assumes scale it doesn't have):

- Retry/backoff policy with `max_attempts`, `next_retry_at` — no evidence of
  rate-limit or transient-failure pain yet.
- Source snapshotting (Wayback/HTML archive) for closed answers — add when a
  cited source actually goes dead, not preemptively.
- Query-template library + progressive query expansion, recorded per-attempt.
- Deduplication/normalization of questions across a topic.
- Embedding-based focus-area clustering, `priority_score` formula
  (`w1*recency + w2*(1-confidence) + w3*open_count`) — current 3-bucket
  string grouping is fine at current volume (9-14 questions/topic).
- Richer focus-area schema: `representative_questions`, `suggested_actions`,
  `sample_fact_ids`.
- Escalation workflow integration: `escalated_to`, `escalation_ticket`,
  auto-created issues. No curator-facing UI exists yet to consume this.
- Idempotency/locking for concurrent per-topic runs — not a real scenario
  yet (one operator, one run at a time).
- Centralized WebSearch rate-limit/caching client, dedicated service
  account, robots.txt compliance layer.
- Recorded "cassette" integration tests for the skill (deterministic
  replay of search responses) — worth doing once the skill's logic
  stabilizes past this first real run.

**What the review missed:** the actual bug class hit on the first live run
(willow-run, 2026-07-24) was archive metadata integrity — transposed fact_id
digits (76226 vs 76266), a typo'd extra digit (777110 vs 77110), and
duplicate entries under inconsistent ID formatting (77210 vs 77210.jpg).
None of the ~20 suggestions above address that class of problem; it was
only caught by the vision-read step (reading actual photo pixels + in-frame
stamped negative numbers), added specifically because generic web search
couldn't touch private-archive photos. Keep that in mind before investing
in the search-infra suggestions above — the highest-value finding so far
came from a completely different axis.
