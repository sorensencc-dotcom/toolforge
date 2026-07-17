# Topic Research Module (TRM) — Design Spec v1.0.0

Status: approved (design phase) — 2026-07-17

## 1. Purpose

A Topic Research Module (TRM) is a standalone, governed research packet storing structured knowledge about one topic. Deep, expandable research kept out of the CIC Treatment Draft, scored/promoted via TorqueQuery, cross-linked to other topics and to Treatment sections.

TRM is a **general-purpose research engine**, not CIC-only — also serves genealogy, Rewrite Labs, future client/business-unit work.

## 2. Repository

Standalone repo: `C:\dev\trm`. No build-time dependency on `cic-ingestion` or `services/torquequery`. Talks to CIC/TorqueQuery only through swappable adapter interfaces.

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
  schemas/                       # JSON Schema for every file type below
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
  "status": "active"
}
```

`status`: `"container"` (node exists as a path segment, no research content yet) or `"active"` (has ingested sources). `parent`/`children` are CLI-maintained, not hand-edited.

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
  "actor": "ACTOR-001",
  "timestamp": "2026-07-17T16:50:00",
  "operations": [
    { "op": "INGEST", "source_id": "SRC-001", "hash": "b7e1f2..." },
    { "op": "EXTRACT", "extract_id": "FCT-001", "hash": "c9d4e1..." }
  ]
}
```

Append-only, chained (each op's hash covers the prior hash + payload). Per-node only — no cross-node hash chaining, preserves topic isolation.

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
- **Rollup**: `trm score <path> --rollup` walks descendants and reports an aggregated view of promoted facts/scores. Read-only, computed on demand — never written to a file, so parent/child data can't drift out of sync.

## 5. Scoring adapter (TorqueQuery decoupling)

Real TorqueQuery is mid-reconciliation (3 uncoordinated implementations, Tier 1 decision pending — `docs/meta/phases/torquequery-reconciliation-charter.md`). TRM v1 does not block on this.

```ts
interface ScoringAdapter {
  score(facts: Fact[], topic: TopicMeta): ScoreResult[];
}
```

- v1 ships `adapters/stub.ts`: deterministic weighted formula over relevance/genealogy/historical/confidence/novelty → `promotion_score`; threshold configurable per-topic or repo-wide config.
- `adapters/torquequery.ts` added once Tier 1 picks a canonical implementation — same `ScoreResult` shape, zero changes needed downstream (score.json schema, promotion logic, crosslinks).

## 6. Lifecycle / CLI

```
trm create <path>                      # init topic.json + dirs (creates intermediate containers)
trm ingest <path> <file|url>           # add source, update sources/metadata.json + lineage
trm extract <path>                     # Claude Code run, fixed prompt per source → extract.json + summary.md
trm score <path> [--rollup]            # ScoringAdapter.score() → score.json
trm crosslink <path> --treatment ... --related ...
trm version-bump <path> [major|minor|patch]
trm validate <path> [--recursive]      # schema + lineage-chain integrity + no hand-edited score.json
```

Actor resolved from `--actor` flag or `TRM_ACTOR` env var, format `ACTOR-NNN` (local registry `trm/registry/actors.json` — decoupled from CIC's registry until a real integration point exists). Every command appends to that node's `lineage.json`.

## 7. Governance rules — mechanism

| Rule | v1 mechanism |
|---|---|
| Spec-aligned (CIC v1.1 §2/S3-A1) | No live copy of that spec section found in repo. Not hard-blocked; revisit when located. |
| Immutable lineage | Append-only, chained hash per node; `trm validate` fails on a broken chain. |
| Deterministic extraction | Fixed, versioned prompt templates in `extraction/prompts/`; same prompt+source → same hash. |
| Promotion discipline | Only `ScoringAdapter.score()` writes `promoted: true`; `trm validate` rejects hand-edited score.json. |
| No drift vs Treatment | Out of scope for v1 — no live Treatment Draft integration point exists in this standalone repo yet. `crosslinks/treatment.json` is a write-only pointer, no diff-check. |
| Topic isolation | Directory boundary enforced in `core/`; no cross-node writes. |
| Audit-ready | `trm validate` rebuilds the lineage chain from stored ops and diffs against the stored hash. |

## 8. Explicitly excluded from v1 (YAGNI)

- Real TorqueQuery API wiring (blocked on Tier 1 reconciliation decision)
- CIC Treatment Draft drift-checking (no live integration point)
- Embedding-based topic similarity for `related_topics.strength`
- Multi-actor concurrent-write locking (single-operator assumption)

## 9. Known discrepancies vs original spec draft

- Actor ID format changed from `ACT-YYYYMMDD-NNNN` to `ACTOR-NNN` to match the real convention already in use (`cic-ingestion/registry/actors.json`).
- Location changed from CIC-embedded `/topics/` to standalone repo `C:\dev\trm`, per decision to make TRM domain-agnostic (genealogy, Rewrite Labs, future business units — not CIC-only).
