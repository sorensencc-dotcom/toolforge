# Topic Research Module (TRM) — Design Spec v1.0.0

Status: approved (design phase) — 2026-07-17

## 1. Purpose

A Topic Research Module (TRM) is a standalone, governed research packet storing structured knowledge about one topic. Deep, expandable research kept out of the CIC Treatment Draft, scored/promoted via TorqueQuery, cross-linked to other topics and to Treatment sections.

TRM is a **general-purpose research engine**, not CIC-only — also serves genealogy, Rewrite Labs, future client/business-unit work.

## 2. Repository

Standalone repo: `C:\dev\trm`. No build-time dependency on `cic-ingestion` or `services/torquequery`. Talks to CIC/TorqueQuery only through swappable adapter interfaces.

### 2.1 config.json

Single repo-root config, one knob for determinism-affecting settings:

```json
{
  "default_scoring_adapter": "stub",
  "promotion_threshold": 80,
  "actor_source": "env",
  "time_source": "system"
}
```

`actor_source`: `env` (read `TRM_ACTOR`) or `cli-only` (require `--actor` every command, no env fallback). `time_source`: `system` or `fixed` (tests inject a fixed clock — needed for deterministic-hash test fixtures).

```
trm/
  topics/<project>/[<topic>/[<subtopic>/...]]   # recursive TRM tree, see §4
  core/                          # TRM CRUD: create, ingest, version-bump, validate
  scoring/
    adapter.ts                   # ScoringAdapter interface
    adapters/stub.ts             # v1: deterministic weighted-formula scorer
    adapters/torquequery.ts      # future: real client, added post Tier-1 reconciliation
  extraction/
    prompts/                     # fixed, versioned prompt templates
    runner.ts                    # shells to Claude Code with prompt + source
  lineage/
    hasher.ts                    # sha256 chain, actor-bound, per-node
  cli/
    trm.ts                       # trm create|ingest|extract|score|crosslink|version-bump|validate
  schemas/                       # JSON Schema for every file type below — machine-enforceable contract, not just doc
  registry/
    actors.json                  # local actor registry, format ACTOR-NNN
```

## 3. TRM Node — file layout (identical at every hierarchy depth)

```
<node-path>/
  topic.json
  sources/
    raw/
    metadata.json
  extracts/
    extract.json
    summary.md
    score.json
  lineage/
    lineage.json
  crosslinks/
    treatment.json
    related_topics.json
```

### 3.1 topic.json

```json
{
  "topic": "automotive",
  "path": "cuba/industry/automotive",
  "parent": "cuba/industry",
  "children": [],
  "version": "1.0.0",
  "created_at": "2026-07-17T16:50:00",
  "updated_at": "2026-07-17T16:50:00",
  "actors": ["ACTOR-001"],
  "description": "...",
  "tags": ["history", "industry"],
  "status": "active",
  "node_type": "subtopic"
}
```

`status`: `"container"` (node exists as a path segment, no research content yet) or `"active"` (has ingested sources). `parent`/`children` are CLI-maintained, not hand-edited. `node_type`: `"project" | "topic" | "subtopic"` — depth-derived label, set by CLI at create time (depth 0 = project, depth 1 = topic, depth 2+ = subtopic). Unused by v1 logic (all nodes behave identically per §4) but reserved for future UI/reporting so depth-semantics don't have to be inferred from path segments later.

### 3.2 sources/metadata.json

```json
{
  "sources": [
    {
      "id": "SRC-001",
      "type": "pdf",
      "title": "...",
      "origin": "...",
      "url": "...",
      "added_at": "2026-07-17T16:50:00",
      "actor": "ACTOR-001"
    }
  ]
}
```

### 3.3 extracts/extract.json

```json
{
  "facts": [
    {
      "id": "FCT-001",
      "text": "...",
      "source_id": "SRC-001",
      "confidence": 0.92,
      "categories": ["history", "industry"]
    }
  ]
}
```

`extracts/summary.md` — human-readable summary, generated same pass as extract.json.

### 3.4 extracts/score.json

```json
{
  "scores": [
    {
      "fact_id": "FCT-001",
      "relevance": 88,
      "genealogy": 10,
      "historical": 90,
      "confidence": 92,
      "novelty": 40,
      "promotion_score": 83.4,
      "promoted": true
    }
  ]
}
```

Written only by `ScoringAdapter.score()` — see §5.

### 3.5 lineage/lineage.json

```json
{
  "topic": "automotive",
  "hash": "a8f3c9d1...",
  "operations": [
    {
      "id": "OP-0001",
      "op": "INGEST",
      "source_id": "SRC-001",
      "hash": "b7e1f2...",
      "actor": "ACTOR-001",
      "timestamp": "2026-07-17T16:50:00"
    },
    {
      "id": "OP-0002",
      "op": "EXTRACT",
      "extract_id": "FCT-001",
      "hash": "c9d4e1...",
      "actor": "ACTOR-001",
      "timestamp": "2026-07-17T16:55:00"
    }
  ]
}
```

Append-only, chained (each op's hash covers the prior op's hash + payload). `id`/`actor`/`timestamp` moved to per-operation (not just root) — root-level fields dropped, forensics/partial-replay need per-op attribution, not just a single latest actor/timestamp. Per-node only — no cross-node hash chaining. Intentional design choice, not an omission: preserves topic isolation (§7), each node independently reconstructable without pulling in ancestor/descendant chains.

### 3.6 crosslinks/

`treatment.json` — facts promoted toward CIC Treatment Draft consideration (write-only pointer in v1, no drift-check — see §7).

`related_topics.json` — cross-topic relationships:

```json
{
  "related": [
    { "topic": "willys", "relationship": "industrial context overlap", "strength": 0.72 }
  ]
}
```

`strength` in v1: operator-set via CLI, or simple tag-overlap score. Embedding similarity deferred (§7).

## 4. Hierarchy — project / topic / subtopic

Every node — project, topic, subtopic — is the **same TRM structure** at any depth. No special-cased "project" type.

```
topics/
  cuba/                      # project (or top-level topic)
    topic.json
    industry/                # topic
      topic.json
      automotive/             # subtopic
        topic.json
      ...
```

- Path is identity: `cuba/industry/automotive`. `topic` field in topic.json is the leaf slug; `path` is the full route.
- `trm create <a>/<b>/<c>` creates missing intermediate nodes as `status: "container"`; a node becomes `"active"` once sources are ingested into it directly.
- **Rollup**: `trm score <path> --rollup` walks descendants and reports an aggregated view of promoted facts/scores. Read-only, computed on demand — never written to a file, so parent/child data can't drift out of sync. `fact_id` is only unique within a single node's `score.json` (§5), so rolled-up entries are tagged with a `topic_path` field to disambiguate which node each score came from — a rollup-only addition, not part of the closed per-node `ScoreResult` shape.

## 5. Scoring adapter (TorqueQuery decoupling)

Real TorqueQuery is mid-reconciliation (3 uncoordinated implementations, Tier 1 decision pending — `docs/meta/phases/torquequery-reconciliation-charter.md`). TRM v1 does not block on this.

```ts
interface ScoringAdapter {
  score(facts: Fact[], topic: TopicMeta): ScoreResult[];
}

type ScoreResult = {
  fact_id: string;
  relevance: number;
  genealogy: number;
  historical: number;
  confidence: number;
  novelty: number;
  promotion_score: number;
  promoted: boolean;
};
```

`ScoreResult` is closed — no extra fields. `schemas/score.json` mirrors this exactly (`additionalProperties: false`), so a future `adapters/torquequery.ts` can't silently pass through extra fields that downstream code ignores.

- v1 ships `adapters/stub.ts`: deterministic weighted formula over relevance/genealogy/historical/confidence/novelty → `promotion_score` (threshold from `config.json`'s `promotion_threshold`, §2.1).
- `adapters/torquequery.ts` added once Tier 1 picks a canonical implementation — same `ScoreResult` shape, zero changes needed downstream (score.json schema, promotion logic, crosslinks).

## 6. Lifecycle / CLI

```
trm create <path>                      # init topic.json + dirs (creates intermediate containers)
trm ingest <path> <file|url> [--dry-run]   # add source, update sources/metadata.json + lineage
trm extract <path> [--dry-run] [--stub]    # Claude Code run (or --stub for naive offline splitter), fixed prompt per source → extract.json + summary.md
trm score <path> [--rollup] [--dry-run]    # ScoringAdapter.score() → score.json
trm crosslink <path> --treatment ... --related ...
trm version-bump <path> [major|minor|patch]
trm validate <path> [--recursive]      # schema + lineage-chain integrity + no hand-edited score.json
```

Actor resolved from `--actor` flag or `TRM_ACTOR` env var per `config.json`'s `actor_source` (§2.1), format `ACTOR-NNN` (local registry `trm/registry/actors.json` — decoupled from CIC's registry until a real integration point exists). Every command appends to that node's `lineage.json`.

`--dry-run` on `ingest`/`extract`/`score`: runs the full pipeline (fetch/extract/score) but writes nothing — no file changes, no lineage append. Lets a pipeline be tested (including against a real `torquequery` adapter once wired) without mutating state.

## 7. Governance rules — mechanism

| Rule | v1 mechanism | Future hook |
| --- | --- | --- |
| Spec-aligned (CIC v1.1 §2/S3-A1) | No live copy of that spec section found in repo. Not hard-blocked; revisit when located. | — |
| Immutable lineage | Append-only, chained hash per node; `trm validate` fails on a broken chain. | — |
| Deterministic extraction | `stubRunner`: byte-identical, same prompt+source → same hash, guaranteed. `claudeCodeRunner` (v1's default, §8): best-effort only — fixed prompt template, but a live LLM call is not guaranteed byte-identical across runs even at temperature 0. Lineage still hashes whatever was produced, so tampering after the fact is still detectable; re-running extraction is not guaranteed to reproduce the same hash. | — |
| Promotion discipline | Only `ScoringAdapter.score()` writes `promoted: true`; `trm validate` rejects hand-edited score.json. | `adapters/torquequery.ts` (§5) |
| No drift vs Treatment | Out of scope for v1 — no live Treatment Draft integration point exists in this standalone repo yet. `crosslinks/treatment.json` is a write-only pointer, no diff-check. | `crosslinks/treatment.json` + future `cic-adapter` diff-check |
| Topic isolation | Directory boundary enforced in `core/`; no cross-node writes. | — |
| Audit-ready | `trm validate` rebuilds the lineage chain from stored ops and diffs against the stored hash. | — |

## 8. Extraction runner (real, non-stub)

`ExtractionRunner` (defined in Task 11 of the implementation plan) has two implementations:

- `stubRunner` — naive line-split, `confidence: 0.5`, `categories: []` fixed. Byte-deterministic. Default for tests and `--stub`.
- `claudeCodeRunner` — v1's default for live `trm extract`. Shells to the `claude` CLI in non-interactive mode:

```bash
claude -p "<fixed prompt>" --output-format json --model sonnet
```

with the source's raw text piped via stdin. Non-`--bare` — uses whatever auth is already active in the environment (subscription/OAuth or API key), no separate credential setup required. `--bare` mode was evaluated and rejected: it refuses subscription/OAuth auth outright (API-key only), and the token-overhead/cost concern that motivated looking at it doesn't apply under a subscription — `total_cost_usd` in the CLI's JSON output is a notional API-equivalent figure, not an actual charge, when running under subscription auth.

**Prompt contract:** the fixed prompt instructs the model to return strict JSON matching `extract.schema.json` — `{"facts": [...], "summary": "..."}` — no prose outside the JSON. Each fact's `categories` must be drawn from a **fixed vocabulary**: `history`, `genealogy`, `industry`, `geopolitics`, `biography`. Free-form categories were rejected — `stubAdapter`'s scoring formula (§5) only recognizes literal `"genealogy"`/`"history"` strings; an unconstrained vocabulary would silently degrade scoring for any fact tagged outside those two words.

**Parsing:** the CLI wraps its answer in a JSON envelope (`{"type":"result", "result": "...", "is_error": bool, ...}`). The runner extracts `result`, parses it as JSON, and validates against `extract.schema.json` before returning.

**Failure mode:** fails hard, no partial writes. A non-zero exit, `is_error: true`, or a `result` that doesn't parse as valid JSON matching the schema throws an `Error` — nothing gets written to `extract.json`, `summary.md`, or `lineage.json`. Matches the existing fail-hard pattern in `runScore` (§5), which already throws on `ScoringAdapter` output that fails schema validation. No silent fallback to `stubRunner` on failure — that would risk shipping garbage facts without the operator noticing.

**Testability:** `claudeCodeRunner` takes an injectable exec function (defaults to a real `child_process` call to `claude`). Unit tests inject a fake that returns canned JSON envelopes — no test spawns a real `claude` process, no test incurs cost or non-determinism.

## 9. Explicitly excluded from v1 (YAGNI)

- Real TorqueQuery API wiring (blocked on Tier 1 reconciliation decision)
- CIC Treatment Draft drift-checking (no live integration point)
- Embedding-based topic similarity for `related_topics.strength`
- Multi-actor concurrent-write locking (single-operator assumption)
- Multi-repo version coordination (TRM ↔ CIC ↔ TorqueQuery compatibility guarantees)
- `--bare` / API-key-only extraction mode (rejected in §8 — subscription auth works fine, `--bare`'s auth restriction and the cost concern that motivated it don't apply)

## 10. Known discrepancies vs original spec draft

- Actor ID format changed from `ACT-YYYYMMDD-NNNN` to `ACTOR-NNN` to match the real convention already in use (`cic-ingestion/registry/actors.json`).
- Location changed from CIC-embedded `/topics/` to standalone repo `C:\dev\trm`, per decision to make TRM domain-agnostic (genealogy, Rewrite Labs, future business units — not CIC-only).
