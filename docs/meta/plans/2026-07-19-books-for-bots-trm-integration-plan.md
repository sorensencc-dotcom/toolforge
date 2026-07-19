---
title: books-for-bots TRM Integration Plan
date: 2026-07-19
status: DRAFT
phase: TRM Expansion
category: Ingest Pipeline & Query Navigation
scope: TIER2_EXECUTION
---

# books-for-bots TRM Integration Plan

## Executive Summary

Integrate books-for-bots (EPUB → seekable Markdown converter) into TRM's ingest pipeline (Option A) and TorqueQuery's query navigation layer (Option B). Enables token-efficient, chapter-aware document reading for LLM agents via byte-offset seeking.

**Why:** EPUB is agent-hostile (ZIP, OPF parsing, spine traversal, cross-document references). books-for-bots solves this deterministically: every book → one GFM Markdown file with YAML frontmatter listing every chapter's byte+line offsets. Agents can read `--offset 412 --limit 200` and land exactly on Chapter 1, no parsing overhead. Matches TRM's goals: deterministic, faithful extraction, no agentic judgment.

**Scope:** TRM expansion only (not a TorqueQuery charter decision). Both canonical TorqueQuery (memory search) and torque-query-docs (doc RAG) can leverage the chapter index independently.

---

## Current State

### TRM Ingest Pipeline

**File:** `c:\dev\trm\src\ingestion\fileConvert.ts`

Current converters:
- `.txt`, `.md` → direct read (fs.readFileSync)
- `.docx` → mammoth.extractRawText
- `.pdf` → pdf-parse (getText)

Output: raw text → stored in `sources/raw/{entry.id}.txt`

**CLI Integration:** `trm ingest --file <path> --title "..." --type <type>`
- Detects file extension
- Calls appropriate converter
- Stores raw text or image JSON
- Returns SourceEntry (registry metadata)

### TorqueQuery Canonical Implementation

**Location:** `cic-ingestion/src/services/torquequery/TorqueQueryV2Server.py`

- FastAPI memory/drift semantic search server
- MMR/RRF fast-path (canary-approved 2026-07-02)
- Used by cic-ingestion adapter (`torqueQueryV2.ts`)
- Scope: agent memory search only (per charter 2026-07-17)

### torque-query-docs (RAG Service)

**Location:** `rewrite-docs/castironforge/torque-query-docs/`

- Doc-KB RAG engine (Chroma vector store, Ollama embeddings, BGE reranker)
- MkDocs-aware document ingestion
- Self-declared PHASE-26-READINESS.md (complete except snapshot tests)
- Not currently wired into CIC adapter (future scope per charter)

---

## books-for-bots Architecture

**Tool:** `https://github.com/prime-radiant-inc/books-for-bots` — Rust binary, ~2,000 LOC, statically linked, zero runtime deps.

**Five-stage pipeline:**
1. **load** — epub crate, extract ZIP metadata, spine ordering, manifest
2. **extract** — DOM parsing (scraper/html5ever), IR to Block/Inline
3. **assemble** — spine stitching, chapter title resolution, footnote namespacing, cross-chapter link rewriting
4. **render** — serialize Block tree to GFM, record chapter heading byte+line positions
5. **write** — YAML frontmatter with leading-padded offsets (invariant size), concatenate, write MD + images/

**Output format:**
```yaml
---
title: "Alice's Adventures in Wonderland"
authors: [Lewis Carroll]
published: 2008-06-27
language: en
source_file: alice-pg11-images.epub
chapters:
  - title: CHAPTER I. Down the Rabbit-Hole
    line:       0000000094
    byte:       0000002866
  - title: CHAPTER II. The Pool of Tears
    line:       0000000158
    byte:       0000014524
  ...
---

## CHAPTER I. Down the Rabbit-Hole

Alice was beginning to get very tired...
```

**Guarantees:**
- Deterministic (same input → byte-identical output)
- Faithful (all text preserved, no agentic judgment)
- Immutable (offsets stable seek targets)

---

## Architecture Decision

**2026-07-19 Tier 2 Decision:** Defer books-for-bots (Rust binary + LFS) pending validation that extraction downstream actually consumes chapter offsets. **Phase A now uses pure-JS EPUB reader** (epub2 / @gxl/epub-parser). **Phase B (books-for-bots) conditional** — only if extraction team confirms offset-aware chunking is needed for research fact processing.

**Why:** Uncertainty on offset consumption + books-for-bots is an external unpackaged Rust binary. Pure-JS matches TRM's existing converter stack (mammoth, pdf-parse) and carries zero binary/CI risk. If offsets prove needed later, architect has already designed Option 3 (LFS binary + resolver) — lower effort to retrofit than to yank a wrong dependency.

---

## Integration Plan

### Phase A: Ingest Pipeline (Pure-JS, Immediate)

**Goal:** Add EPUB support to TRM's fileConvert.ts using pure-JS epub2/parser. Text extraction only (no chapter offsets yet).

**Changes:**

1. **Add epub2 dependency** — `npm install epub2` (pure-JS, zero runtime deps, matches mammoth/pdf-parse stack)

2. **Extend fileConverters interface**
   ```typescript
   export interface FileConverters {
     extractDocx: (filePath: string) => Promise<string>;
     extractPdf: (buffer: Buffer) => Promise<string>;
     extractEpub: (filePath: string) => Promise<string>;
   }
   ```

3. **Implement extractEpub**
   - Open EPUB file (zip-based)
   - Extract spine documents in order
   - Parse XHTML → plain text
   - Concatenate chapter text
   - Return raw text (matching existing converter contract)

4. **Update convertFileToText**
   - Add `.epub` to `SUPPORTED_EXTENSIONS`
   - Route to extractEpub
   - Store text in `sources/raw/{entry.id}.txt` (existing behavior)

**Files to create/modify:**
- `src/ingestion/fileConvert.ts` — add extractEpub, update converters interface
- `src/ingestion/epubExtract.ts` (new) — wrapper around books-for-bots CLI
- `package.json` — add books-for-bots dependency (or document manual install step)

**Test coverage:**
- Unit: extractEpub with synthetic EPUB (using epub-builder, matching books-for-bots test pattern)
- Integration: real EPUB (Alice public domain) → verify chapter offsets match expected
- CLI: `trm ingest --file alice.epub --title "Alice" --type book` → verify metadata stored

---

### Phase B: Query Navigation (Option B)

**Goal:** Both TorqueQuery and torque-query-docs leverage chapter index for offset-aware seeking.

**For TorqueQuery (memory search):**

1. **Vector chunking aware of chapters**
   - When ingesting EPUB-sourced facts, split at chapter boundaries (not arbitrary token windows)
   - Embed chapter context: `[Chapter: "CHAPTER I. Down the Rabbit-Hole"] <fact text>`
   - Allows MMR/RRF ranking to favor facts from specific chapters

2. **Query filter by chapter**
   - New query param: `?chapter_index=2&chapter_title_filter="Pool of Tears"`
   - Filters results to fact chunks from that chapter only
   - Uses byte offset range from metadata to scope embedding retrieval

**For torque-query-docs (doc RAG):**

1. **Chunk boundaries at chapter headers**
   - Override Chroma default chunking with chapter-aware split
   - Each chunk: (chapter title + offset range, markdown text)
   - Enables "retrieve facts from Chapter 3" queries

2. **Byte-offset ranking signal**
   - Reranker (BGE) can use chapter distance as tie-breaker
   - Docs from target chapter ranked higher if relevance score ties

**Files to create/modify:**
- `cic-ingestion/src/services/torquequery/` — add chapter-aware chunking
- `rewrite-docs/castironforge/torque-query-docs/` — update ingestion to respect chapter boundaries
- Integration tests: verify chapter filtering + ranking behavior

**Dependencies:**
- No new external deps (books-for-bots metadata already in registry)
- Both services already support metadata filtering; chapter index is just another metadata field

---

## Acceptance Criteria

### Phase A (Ingest, Pure-JS)
- [ ] EPUB support added to fileConvert (extractEpub implemented + tested)
- [ ] `trm ingest --file alice.epub` produces text output in sources/raw/{id}.txt
- [ ] Text extraction verified: chapter content intact, no corruption
- [ ] CLI help text updated to list `.epub` as supported extension

### Phase B (Query)
- [ ] TorqueQuery accepts chapter filter params (no-op if metadata absent, graceful fallback)
- [ ] torque-query-docs chunks respect chapter boundaries
- [ ] Integration test: query with `chapter_index=2` returns facts from Chapter 2 only
- [ ] Both services handle mixed (EPUB + PDF + DOCX) ingestion without breaking

### General
- [ ] No regressions in existing PDF/DOCX/TXT ingest flows
- [ ] books-for-bots binary distribution stable (version pinned in package.json or submodule)
- [ ] Documentation: README updated with EPUB ingest example, chapter-filtering query docs
- [ ] Codex test suite passes (20/20 or better)

---

## Risks & Mitigation

| Risk | Impact | Mitigation |
|------|--------|-----------|
| books-for-bots is Rust; TRM is TypeScript/Node | Build complexity, platform-specific binaries | Publish books-for-bots as npm package (WASM or pre-built binaries for Win/macOS/Linux) or document external tool install step |
| YAML frontmatter parsing edge cases (quotes, escapes) | Ingestion fails silently or corrupts metadata | Use yaml library with comprehensive test suite (existing deps); validate output against books-for-bots spec examples |
| Chapter metadata not always present (non-EPUB books) | torque-query-docs may fail if expecting chapters on all docs | Design with graceful fallback: if metadata absent, use default chunking (existing behavior) |
| Two repos (cic-ingestion + torque-query-docs) need independent updates | Divergent implementations, duplicate code | Define chapter-metadata interface in shared schema; both services consume same format |
| Performance: EPUB conversion slow for large books | Ingest lag, poor UX | books-for-bots runs in <1s on Alice (1832 lines); cache converted output (idempotent, stable offsets) |

---

## Implementation Order

1. **Phase A (Ingest)** — TRM expansion, self-contained
   - Add books-for-bots dep
   - Implement extractEpub
   - Update CLI routing, tests
   - Merge to main

2. **Phase B (Query)** — Parallel or sequential (post-A)
   - TorqueQuery chapter-aware chunking (cic-ingestion, Tier 2)
   - torque-query-docs chapter boundaries (rewrite-docs, Tier 2)
   - Integration tests (cross-repo)
   - Merge both

**Timeline:** Phase A: 1–2 days (straightforward wrapper). Phase B: 3–5 days (vectorization, reranking tuning).

---

## Rollout Strategy

1. **Pilot:** Ingest one real EPUB (Alice, or user-provided book) via TRM CLI
2. **Verify:** Confirm byte offsets match `dd` test command
3. **Query pilot:** Search TorqueQuery with chapter filter on EPUB-sourced facts
4. **Expand:** Add to main ingest pipeline, document in CLI help
5. **Monitor:** Codex test suite post-merge (catch integration breaks early)

---

## Decision Gates

- **Tier 2:** Proceed with Phase A (TRM ingest expansion) — approved by user
- **Tier 2:** Proceed with Phase B (query navigation) — approved by user post-Phase-A review
- **Tier 1:** If Phase B requires schema changes to shared registry → escalate for alignment review

---

## Next Steps (Awaiting Approval)

1. User confirms Phase A + B scope ("yes, proceed" or modifications)
2. Dispatch Phase A to builder (ijfw:ijfw-builder or caveman:cavecrew-builder)
3. Review Phase A output; merge to main
4. Plan Phase B based on Phase A learnings
5. Dispatch Phase B parallel or sequential
