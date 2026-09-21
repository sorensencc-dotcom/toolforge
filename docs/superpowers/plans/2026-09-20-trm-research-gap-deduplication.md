# Implementation Plan: TRM Cross-Notebook Gap Deduplication and Lifecycle Engine

Establish a deterministic, single-source-of-truth pipeline to extract atomic research gaps from multi-notebook mining snapshots, eliminate duplicate questions across notebooks via exact hash and canonical alias tables, and prevent state drift through an audited resolution lifecycle.

---

## User Review Required

> [!IMPORTANT]
> **Single Authority Model Locked**: The Git-tracked canonical registry (`wiki/research/` notes and `trm-research-gaps.md`) is the sole write authority. SQLite (`.kb_cache/knowledge.db`) acts as a derived, rebuildable read-cache and FTS5 search index.
>
> **No Per-Notebook Answer Logs**: Answered question lists will **not** be injected into individual NotebookLM notebooks. Instead, resolved research notes are compiled into thematic `.nlm_pack` knowledge packs with explicit synthetic provenance markers and grounded as reference source documents.

---

## Open Questions

None. The architectural strategy was verified against Codex review and refined with strict hash delimiters and lifecycle transition edges.

---

## Proposed Changes

### Component 1: Gap Normalizer and Alias Matcher

#### [NEW] [gap-normalizer.mjs](file:///c:/dev/modules/trm/gap-normalizer.mjs)
- Implements `normalizeResearchGap(rawText)`:
  - Cleans prompt citations (`[1]`, `[2]`), conversational preambles, and markdown formatting.
  - Extracts subject entity, predicate claim, time period, and location.
  - Computes deterministic `scope_hash` via SHA-256 over unit-separator (`\x1f`) delimited tokens.
- Implements `resolveGapIdentity(gapObj, existingGaps, aliasMap)`:
  - Tier 1: Exact `scope_hash` / normalized objective match $\rightarrow$ auto-merge source provenance.
  - Tier 2: Canonical alias lookup in `trm-gap-aliases.json` $\rightarrow$ link to existing `GAP-XX`.
  - Tier 3: SQLite FTS5 lexical candidate search $\rightarrow$ queue for human review if similarity $>0.85$.
  - Tier 4: Greenfield $\rightarrow$ generate new sequential `GAP-XX` ID.

#### [NEW] [trm-gap-aliases.json](file:///c:/dev/data/trm-gap-aliases.json)
- Canonical lookup table mapping known alternative phrasings and historical variants (e.g. "B-17 production Willow Run" $\rightarrow$ `GAP-03-VIDEOS`).

---

### Component 2: Closed-Loop Ingestion & Triage Pipeline Integration

#### [MODIFY] [run-closed-loop-research-v2.mjs](file:///c:/dev/scripts/run-closed-loop-research-v2.mjs)
- Wire `gap-normalizer.mjs` into Step 1 (Gaps Ingestion):
  - Ingest raw gap snapshots from `C:/Users/soren/trm-vault/trm/research-gaps/*.md`.
  - Filter out previously resolved (`[x] Resolved`) or retired gaps matching exact `scope_hash`.
  - Collate multi-notebook occurrences into the `source_notebooks` provenance array of existing active `GAP-XX` records.
  - Write normalized, deduplicated gap snapshot to `trm-research-gaps.md`.

#### [MODIFY] [gap-triage-engine.mjs](file:///c:/dev/modules/trm/gap-triage-engine.mjs)
- Update RFC note generation to include all linked source notebooks and provenance citations.
- Enforce the state machine: `discovered` $\rightarrow$ `clustered` $\rightarrow$ `active` $\rightarrow$ `resolved` $\rightarrow$ `published` $\rightarrow$ `retired` (and `reopened`).

---

### Component 3: Knowledge Pack Grounding & Provenance Tagging

#### [MODIFY] [nlm-pack-compiler.mjs](file:///c:/dev/modules/trm/nlm-pack-compiler.mjs) (or closed-loop Step 6)
- Inject structured frontmatter into every synthesized `.nlm_pack/pack_*.txt` entry:
  ```yaml
  provenance_type: "synthesized_canonical_resolution"
  canonical_gap_id: "GAP-03-VIDEOS"
  source_evidence_citations: ["WPB Schedule contracts", "BVD Pool records"]
  generation_timestamp: "2026-09-20T20:00:00Z"
  ```
- Ensure mining parsers ignore quotes marked with `synthesized_canonical_resolution` during future primary claim extraction.

---

### Component 4: Test Suite & Verification

#### [NEW] [gap-normalizer.test.mjs](file:///c:/dev/kb-sync/tests/gap-normalizer.test.mjs)
- Unit tests for:
  1. Token extraction and unit-separator delimiter safety (no collision between `AB+C` and `A+BC`).
  2. Compound question splitting into atomic objectives.
  3. Alias resolution mapping.
  4. Multi-notebook provenance aggregation.
  5. State transition validation (including `reopened` and `blocked`).

---

## Verification Plan

### Automated Tests
1. **Gap normalizer unit tests**:
   ```bash
   node --test kb-sync/tests/gap-normalizer.test.mjs
   ```
2. **TRM query expander & triage tests**:
   ```bash
   node --test kb-sync/tests/query-expander.test.mjs
   ```
3. **SQLite cache & FTS5 integration tests**:
   ```bash
   npm run test:cache
   ```
4. **End-to-end sandbox closed-loop execution**:
   ```bash
   $env:TRM_SKIP_MINE='1'; node scripts/run-closed-loop-research-v2.mjs
   ```

### Manual Verification
1. Inspect `trm-research-gaps.md` to confirm that multi-notebook occurrences (such as B-17 or L-Bend entries) collapse into a single canonical row with multi-notebook provenance tags.
2. Verify that existing `[x] Resolved` gaps remain retired and are not regenerated as duplicate open gaps during ingestion sweeps.
