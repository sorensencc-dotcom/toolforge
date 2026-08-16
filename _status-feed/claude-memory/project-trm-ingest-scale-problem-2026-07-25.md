---
name: project-trm-ingest-scale-problem
description: "TRM ingest pipeline (per-photo-agent vision review) does not scale past small test batches -- thousands of items still queued, needs real architecture pass before Benson Ford."
metadata: 
  node_type: memory
  type: project
  modified: 2026-07-25T04:30:13.474Z
  originSessionId: 1a4b024e-1309-431a-9262-f57816a83582
---

MFM (Michigan Flight Museum) batch — 188 photos + 5 transcripts — is running as
a small-scale validation of the manual curator-decision pipeline (4 parallel
general-purpose agents, ~47 photos each, one Read+judge per photo). User
flagged mid-run that this doesn't scale: three bigger things are queued
behind it:

1. **Benson Ford Research Library visit** — bigger than MFM, mostly
   **photos of documents**, not exhibit/artifact photos. Doc-photos need an
   OCR/transcription-first path, not the vision-judgment-of-a-scene rubric
   built for MFM. [[project-trm-flight-museum-benson-ford-ingest-pending-2026-07-24]]
2. **Thousands of existing items** the user has been sitting on or already
   fed to claude.ai chats in the past (that prior work is literally what set
   the TRM research direction). These need re-ingestion — different shape
   than photos (chat text/exports), needs its own extraction step.
3. **Eventual full dump** — "dump everything I have" — the end state once
   Benson Ford is done.

**Why:** one-agent-per-~47-photos with serialized per-image Read calls is
the only ingest path that exists right now (confirmed: no automated
raw-intake script — see [[project-trm-flight-museum-benson-ford-ingest-pending-2026-07-24]]).
That's fine for a 188-photo validation batch: it will not hold up for
thousands of items or for doc-heavy Benson Ford volume.

**How to apply:** do NOT scale the current approach linearly (more parallel
agents of the same shape) for Benson Ford or the "everything" dump — do a
real architecture pass first (user explicitly wants this as deliberate
"deep think", not an in-flight patch). Things worth evaluating in that pass:
- OCR-first / structured-extraction path for doc-photos, separate from the
  scene-vision-judgment rubric used for exhibit photos
- Bulk pre-filtering (dedup, blur/quality filter) before spending any vision
  call, since vision calls are the expensive/slow part
- Batching multiple images into one reasoning pass instead of one image per
  agent turn
- A separate extraction path for old claude.ai chat content (text, not
  images) — not the same pipeline as photo ingest at all
- Model choice per stage (cheap/fast triage vs. careful judgment) rather than
  one model tier for the whole pipeline

Trigger for that design session: right after MFM's 4 background batches
finish and curator-decisions-final.json is built for MFM — before starting
any Benson Ford work.
