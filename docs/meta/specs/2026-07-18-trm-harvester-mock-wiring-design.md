# TRM Harvester Mock Wiring — Design

**Date:** 2026-07-18
**Status:** Approved, ready for implementation plan
**Repo:** `trm` (implementation target); `cic-ingestion` (source of vendored code)

## Background

Prior session memory recorded an unverified claim: "CIC Harvester already exists,
production-grade — `ImageAnalyzerV3` (scene/context/people/place/geolocation),
`ReverseImageSearchExtractor` (full test coverage), queue/DLQ ingestion pipeline."
This session verified the claim against live code in `c:\dev\cic-ingestion` before
any design work, per the memory system's "verify before recommending" rule.

**Verification result — claim was largely false:**

| Claimed | Actual |
| --- | --- |
| `ImageAnalyzerV3` (scene/context/people/place/geolocation) | Does not exist anywhere in the repo. No such capability. |
| `ReverseImageSearchExtractor`, full test coverage | Exists at `cic-ingestion/src/extractors/ReverseImageSearchExtractor.ts`, registered in `ExtractorRegistry`. **Zero test files found** (`*ReverseImageSearch*test*` glob: no matches). |
| Production-grade Vision API integration | `_callVisionApi()` is a hardcoded stub returning 2 fake URLs (comment: "Mock API call — in production would call actual Vision API"). No `VISION_API_KEY` exists anywhere. |
| Queue/DLQ ingestion pipeline | Real — `src/queue/dlq.ts`, `src/orchestrator/IngestionOrchestrator.ts` confirmed present and substantive. |
| Harvester entrypoint wires the image extractor | `src/harvester/index.ts` only maps a `client_session` extractor. Image extractor is registered in `ExtractorRegistry` but not wired into the harvester's own dispatch table. |

**Conclusion:** what exists is a mock-data skeleton extractor plugged into a real
queue/DLQ pipeline, not a production image-analysis system. This design wires
TRM to the mock skeleton first, to validate the pipeline shape end-to-end,
before any real vision capability is built.

## Scope

In scope: `trm ingest --file <image>` produces a stored, mock-flagged source
entry via the vendored extractor. Out of scope: real Vision API integration,
`ImageAnalyzerV3` or any new analysis capability, HTTP service wiring to a live
cic-ingestion instance.

## Architecture

Vendor `ReverseImageSearchExtractor.ts` + `IExtractor.ts` from `cic-ingestion`
into `trm/src/ingestion/imageExtract/`, in-process (no network hop, no shared
build config). This is a deliberate throwaway stage: once real vision analysis
exists in `cic-ingestion`, TRM should call it as a live HTTP service instead of
importing vendored mock code — see Migration Path below.

**Accepted risk:** the vendored copy has no automated drift check against
`cic-ingestion`'s source. If `cic-ingestion`'s extractor changes before
migration, the two copies silently diverge. Low stakes since both are
mock-only, and Migration Path below deletes the vendored copy outright rather
than reconciling it — this is a known tradeoff for the mock stage, not an
oversight.

`trm ingest --file` auto-detects image extensions (`jpg`, `jpeg`, `png`,
`webp`, `gif`) and routes to the new extractor path instead of
`convertFileToText`, using the same extension-dispatch pattern
`fileConvert.ts` already uses for docx/pdf/txt/md.

## Components

- `trm/src/ingestion/imageExtract/ReverseImageSearchExtractor.ts`,
  `IExtractor.ts` — vendored copies. Header comment on both:
  `// Vendored from cic-ingestion/src/extractors/. Mock-only stub — see
  docs/meta/specs/2026-07-18-trm-harvester-mock-wiring-design.md for the
  real-vision migration plan.`
- `trm/src/ingestion/imageExtract/index.ts` — new `extractImage(filePath):
  Promise<ExtractionResult>`. Reads file into a `Buffer`, calls the vendored
  extractor, returns its result unmodified.
- `trm/src/ingestion/fileConvert.ts` — extension check moved earlier: image
  extensions no longer reach `convertFileToText`.
- `trm/src/cli/commands/ingest.ts` — new branch: for image files, calls
  `extractImage()` **before** `addSource()` (same order as the existing
  `--file` docx/pdf path — extract first, register only on success, so a
  failed extraction never orphans a registered source), wraps the result as
  `{ ...result, mock: !result.metadata.visionApiUsed }` (flag last, so it
  always wins if `ExtractionResult` ever grows its own `mock` field
  upstream), and writes it to `sources/raw/SRC-###.json` (not `.txt`).
  `addSource()` registration is unchanged — same `type`/`title`/`origin`/`url`
  shape, `url` stays the existing `local:<basename>` pattern used for
  `--file`.

## Data Flow

```text
trm ingest --file photo.jpg <topic>
  -> extension check (image type detected)
  -> extractImage(path) -> Buffer -> ReverseImageSearchExtractor.extract()
  -> ExtractionResult { matches[], metadata }
  -> wrap: { ...ExtractionResult, mock: !metadata.visionApiUsed }
  -> write sources/raw/SRC-###.json
  -> addSource() registers entry (unchanged path)
```

## Error Handling

- Corrupt/unsupported image (bad magic bytes): extractor already returns
  `_createErrorResult()` with `metadata.error` set and no matches. `ingest.ts`
  still writes this as JSON — it's data, not an exception. Consistent with
  today's pattern where `trm validate` is the layer that catches malformed
  sources, not `ingest`.
- Bad file path: `extractImage()` throws on read failure before the extractor
  runs; propagates uncaught, same as `convertFileToText`'s existing failure
  mode (non-zero exit, stack trace). This happens **before** `addSource()` is
  called (see Data Flow / Components ordering above), so a bad path never
  leaves an orphaned registered source with no backing file — same fix
  applied to the `--file` docx/pdf path in the prior ingest-file-convert
  spec.
- No special-case needed for a missing Vision API key — the extractor's mock
  fallback is automatic and is expected to fire on every call until real
  vision integration exists.

## Mock Data Flagging

`ReverseImageSearchExtractor` returns fake data (`mock.example.com` URLs,
hash-derived fake similarity scores) whenever `visionApiUsed` is `false` —
which is always, today. To prevent this from silently becoming a cited "real"
fact later:

- Every image source JSON carries `mock: true` when `visionApiUsed` is false.
- `trm validate` gets one new check: any `sources/raw/*.json` with
  `mock: true` emits a WARN (non-blocking): `"SRC-### is mock
  image-extraction data, not a verified fact source"`.

## Testing

- Unit test: `extractImage()` wrapper against a real small image fixture
  (valid JPEG/PNG in, `ExtractionResult` out).
- Unit test: `ingest.ts` extension-routing — image extension routes to the
  new JSON path; non-image extensions are unaffected (still `.txt` via
  `convertFileToText`).
- Unit test: new `trm validate` WARN fires on `mock: true` sources and does
  not fire on non-mock or non-image sources.
- Process: same subagent-driven-development pattern as this session's two
  shipped TRM features — one task per component above, task-level review,
  then one final whole-branch review before merge.

## Migration Path (future, out of scope here)

When `cic-ingestion` grows a real Vision API integration (real
`VISION_API_KEY`, real `_callVisionApi()` implementation) or a real
`ImageAnalyzerV3`-equivalent capability, replace this stage's in-process
vendored import with an HTTP call from TRM to a running `cic-ingestion`
service (it already has `AutonomyAPIServer`/`ingestionRouter` — an endpoint
would sit on that existing surface). At that point the vendored files in
`trm/src/ingestion/imageExtract/` should be deleted, not kept as a fallback,
to avoid two divergent copies of extraction logic.
