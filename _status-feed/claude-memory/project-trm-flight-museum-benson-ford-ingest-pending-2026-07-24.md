---
name: project-trm-flight-museum-benson-ford-ingest-pending
description: "Two completed research trips (Michigan Flight Museum, Benson Ford Research Library) with photos/doc-photos/transcripts awaiting ingest into the TRM research-questions pipeline."
metadata: 
  node_type: memory
  type: project
  originSessionId: fca6dcee-f6dd-473d-b31e-9b5879c5d874
  modified: 2026-07-25T00:37:18.951Z
---

User completed research trips to Michigan Flight Museum and the Benson Ford
Research Library — a couple hundred photos plus photos of documents plus
transcripts, not yet ingested. Plan: Michigan Flight Museum material gets
processed in the next session; Benson Ford material in a session after that.

**Why:** further testing/refinement of the TRM research-questions pipeline
(scan-gaps.mjs / research-questions skill / update-focus-areas.mjs, see
[[project-preflight-underlying-scripts-broken-2026-07-23]] era work) needs
real volume beyond the single willow-run batch already processed.

**How to apply:** when a new session opens about this, two gaps to flag
immediately, not silently work around:
1. No automated raw-intake script exists — `curator-decisions-final.json`
   (input to curator-decision-processor.mjs) was hand-built by Claude
   reviewing photos one by one in an earlier session. That review has to
   happen fresh for each new batch; there's no shortcut yet.
2. Transcripts and photographed documents are a new media type this
   pipeline has never handled — everything built through 2026-07-24
   (vision-first photo judgment in skills/research-questions/SKILL.md)
   assumes photo evidence only. Needs its own design pass, not an
   assumed extension of the photo-vision logic.

Pipeline as of 2026-07-24 (commit cc73c13, pushed): scan-gaps.mjs,
update-focus-areas.mjs, research-questions skill with vision-first photo
judgment + id_mismatch_flagged/id_mismatch_observed fields, deterministic_id/
created_at/llm provenance fields. Deferred external-review items (retry
policy, snapshotting, embeddings, curator UI) logged in
docs/meta/trm-deep-harvester-roadmap.md, not built.
