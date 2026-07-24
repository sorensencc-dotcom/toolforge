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
