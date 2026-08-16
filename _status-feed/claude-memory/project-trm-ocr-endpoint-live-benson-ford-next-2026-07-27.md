---
name: project-trm-ocr-endpoint-live-benson-ford-next-2026-07-27
description: "cic-ingestion /api/analyze/ocr built + live-verified against real Google Vision API this session; Benson Ford real ingest deferred to next session."
metadata:
  type: project
  originSessionId: d0bddb46-1770-430a-a668-ee0f4c688ce6
  modified: 2026-07-27T17:56:59.235Z
---

`$CIC_INGESTION_URL`'s `/api/analyze/ocr` (D-02 in
[[project-trm-flight-museum-benson-ford-ingest-pending]]'s
benson-ford-prep CONTEXT.md) didn't exist server-side before this session --
only the trm-side client (`ImageAnalyzer.ocr()`) was built. Built the missing
half: `GoogleVisionProvider.ocrImage()` (DOCUMENT_TEXT_DETECTION),
`ImageAnalysisService.ocr()`, the route, types, exports. tsc clean, 16/16
tests pass. Landed in commit b41c3055 (see
[[finding-cic-ingestion-autocommit-push-daemon-2026-07-27]] -- committed/pushed
by something other than an explicit git command this session).

Went further and made it actually live, not just mock-verified:
- No GCP project on this account had Vision API enabled -- enabled it on
  `cast-iron-productions-llc`.
- No gcloud auth, no ADC configured on this machine at all -- ran
  `gcloud auth login` + `gcloud auth application-default login` (user
  completed browser flow both times), now at
  `%APPDATA%\gcloud\application_default_credentials.json`.
- Hit both `/api/analyze/ocr` and `/api/analyze/image` with `VISION_API_KEY`
  set, got back `visionApiUsed:true, apiProvider:google_vision`, ~1000ms
  real network latency, real web-detection matches -- confirmed live, not
  mock fallback.
- `.env` still needs `VISION_API_KEY=live` + `VISION_API_PROVIDER=google_vision`
  added manually -- the project's pre-commit hook blocks direct `.env` edits
  via tooling (Edit tool refused), so this is a manual step, not done yet.

**Why:** user corrected an earlier claim ("Michigan Flight Museum already
used vision") -- turned out that ingest used Claude reading photos directly
(hand-reviewed, no Google Vision API), a different mechanism from this
endpoint. Not a contradiction; confirmed via memory + git history + gcloud
project audit that real Vision API had never been used from this machine
before today.

**Still open, deferred to next session (Benson Ford real ingest):**
1. Add the two `VISION_API_KEY`/`VISION_API_PROVIDER` lines to
   `cic-ingestion/.env` manually first.
2. Classifier (`trm/src/ingestion/imageExtract/classify.ts`) is aspect-ratio
   heuristic only, never tested against real scans -- spot-check a handful
   of real Benson Ford files with `--kind` override vs auto before trusting
   it on the full batch.
3. Concurrency (`TRM_IO_CONCURRENCY` default 8, vision/claude pools default 4)
   still untuned against real rate limits at scale.
4. `trm ingest-dir`'s `--dir` CLI flag exists in code
   (`IngestDirOptions.dir`) but isn't wired into `cli/index.ts`'s commander
   registration -- real files currently need to live inside the topic node
   dir itself (`trm create <topic>` first, then drop files under
   `topics/<topic>/`), can't point at an arbitrary source folder yet.
5. Run `trm ingest-dir` on a small real sample (10-20 files) first, check
   `failed.json`/`manifest.json` by hand, before the full corpus.
