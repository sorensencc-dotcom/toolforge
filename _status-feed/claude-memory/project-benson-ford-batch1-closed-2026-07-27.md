---
name: project-benson-ford-batch1-closed-2026-07-27
description: Benson Ford real ingest batch1 (15 files) closed with real live Vision OCR; server infra was broken end-to-end and got fixed along the way; 241 files + body-size limit left for next session.
metadata: 
  node_type: memory
  type: project
  modified: 2026-07-27T23:16:34.969Z
  originSessionId: 658bbda9-9a8f-4470-a925-f9cd6c15a5ba
---

Continuation of [[project-trm-ocr-endpoint-live-benson-ford-next-2026-07-27]].
Ran the deferred Benson Ford real-ingest plan end to end for a 15-file batch.

**Infra found broken, fixed this session (all pushed):**
- `trm`'s `ingest-dir --dir` flag existed on `IngestDirOptions` but was never
  registered as a commander option in `src/cli/index.ts` -- fixed (commit
  `d5f35b3`, pushed to `sorensencc-dotcom/TRM`).
- `trm`'s `metadata.schema.json` rejected `contentHash`, a field
  `ingest-dir`'s image path always writes via `addSource()` -- this was the
  first real image-batch topic to ever hit `validate`. Fixed same commit.
- Added 15 new tests (11->26) covering both: `classify.ts` JPEG dimension
  parsing (no existing fixture had real SOF/dimensions) + the 1.3
  aspect-ratio boundary, and metadata-schema `contentHash` regression.
  Full trm suite: 186/186 passing.
- `cic-ingestion`'s dev server has **never actually worked**: `start:dev`
  (`ts-node --esm`) can't resolve `.js`-suffixed TS imports under Node 24
  (ts-node 10.9.2 predates Node's newer loader-registration API); `dist/`
  is stale AND unbuildable (`tsconfig.json` has `noEmit:true`, plus an
  invalid `ignoreDeprecations: "6.0"` value blocks `tsc` outright for
  installed TypeScript 5.9.3). Installed `tsx` as a working alternative
  (commit `07c8917c`, pushed to `sorensencc-dotcom/cic-ingestion`).
  `start:dev` itself was NOT repointed at tsx -- still runs the broken
  ts-node path. Run the server next session via:
  `set -a; source .env; set +a; npx tsx src/server.ts`
- **Biggest catch:** `cic-ingestion` has no `dotenv` anywhere in `src/` --
  `.env` is never loaded into `process.env` by the app itself. The first
  batch attempt ran 100% silently on mock (empty OCR text, no error
  logged) because of this, not because of any Vision API problem. Only
  caught by comparing latency (13ms mock vs 300-500ms+ real) and manually
  re-running with `.env` sourced into the shell. This will bite again
  every session unless the server is started with env sourced manually
  (no permanent fix applied -- either add `dotenv.config()` to
  `server.ts`, or keep sourcing `.env` by hand every time).

**Classifier verdict:** aspect-ratio heuristic in `trm/src/ingestion/imageExtract/classify.ts`
was NOT wrong for this batch -- these are archive-shelf photos with real,
readable box-label text (Charles E. Sorensen Records boxes), not flat
document scans, and real DOCUMENT_TEXT_DETECTION found that text correctly
once Vision was genuinely live. No fix needed; the heuristic's own docstring
already flags it as a placeholder, this was just confirmation it happened to
be right here, not proof it's robust in general.

**Batch1 result:** `charlie/benson-ford` topic in `C:\Users\soren\trm-vault`,
14/15 files real-ingested (SRC-016..029 after cleanup -- had to hand-prune
SRC-001..015, stale mock/duplicate entries left behind because `--force`
appends new source entries rather than replacing on hash match). 1 failure:
`IMG_2222.jpg` (largest original, 5.7MB HEIC) hit the server's 10MB body
-size limit. `trm validate charlie/benson-ford` passes clean.

**Still open for next session (fresh session per user request):**
1. Raise cic-ingestion's Express body-size limit past 10MB (or downscale
   HEIC->JPEG conversion quality/size) so the largest files don't 413.
2. Convert + ingest the remaining 241 HEIC files in
   `C:\dev\research-data\raw\Benson-Ford` (only 15 done).
3. Server still needs `.env` sourced into shell manually each start --
   no dotenv wired in yet.
4. `/api/analyze/image` (the non-OCR "photo" path) is still mock-only --
   fine for this batch (everything classified as text-doc and used OCR),
   but will matter if a future Benson Ford file classifies as `photo`.
