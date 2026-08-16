---
name: session-handoff-2026-07-25-mfm-merge-pending
description: "MFM photo-review batches (1,2,4 done, 3a/3b running) need merging into curator-decisions-final.json and running through the TRM ingest pipeline in a fresh session."
metadata: 
  node_type: memory
  type: project
  modified: 2026-07-25T17:27:12.641Z
  originSessionId: 1a4b024e-1309-431a-9262-f57816a83582
---

## Where things stand

MFM (Michigan Flight Museum) visit ingest — see
[[project-trm-flight-museum-benson-ford-ingest-pending-2026-07-24]] and
[[project-trm-ingest-scale-problem-2026-07-25]].

**Done this session:**
- 188 HEIC photos converted to JPG:
  `C:/dev/research-data/raw/Mfm-visit/converted/*.jpg`
- 5 Granola transcripts (MFM visit voice memos) extracted via
  `query_granola_meetings` (paid-tier transcript unavailable, used AI
  summaries instead) and saved as raw sources:
  `C:/Users/soren/trm-vault/topics/charlie/michigan-flight-museum/sources/raw/transcript-*.txt`
- Topic scaffolded at
  `C:/Users/soren/trm-vault/topics/charlie/michigan-flight-museum/`
  (topic.json, sources/raw, analyzed, trm-ingest, vision-analysis dirs)
- Photo vision-review batches, output in
  `C:/Users/soren/trm-vault/topics/charlie/michigan-flight-museum/trm-ingest/`:
  - `batch-01-decisions.json` — 47 photos, 34 link-to-fact / 4 new-fact / 9 reject. DONE.
  - `batch-02-decisions.json` — 47 photos, 34 link-to-fact / 4 new-fact / 9 reject. DONE.
  - `batch-04-decisions.json` — 47 photos, 27 link-to-fact / 0 new-fact / 20 reject. DONE.
  - `batch-03-decisions.json` — original attempt hung 9+ hours (background
    agent stalled silently, killed via TaskStop), retry also stalled after
    600s (watchdog caught it faster). Re-split into two smaller sub-batches
    running as background agents at end of this session:
    - `batch-03a-decisions.json` — 24 photos (IMG_2116–IMG_2139). DONE: 15
      link-to-fact / 4 new-fact / 5 reject.
    - `batch-03b-decisions.json` — 22 photos (IMG_2140–IMG_2165). STILL
      RUNNING as of session end — check this first in the next session.
    If batch-03b is missing/incomplete/stalled, re-run it (same rubric/prompt
    pattern as the other batches this session).

**Next session — do this first:**
1. Check `batch-03a-decisions.json` and `batch-03b-decisions.json` exist and
   have 24 + 22 decision entries respectively (46 total). If either is
   missing/incomplete/stalled, re-run that sub-batch (see prompt pattern used
   for batches 1/2/4/3a/3b in this session's transcript, or just re-derive:
   same rubric, same topic list, same output shape).
2. Merge all 5 batch files (01, 02, 03a, 03b, 04 — 187 photo decisions total;
   note original folder had 188 HEIC but confirm exact count, some file may
   have been skipped/duplicate-named) into one
   `curator-decisions-final.json` at
   `C:/Users/soren/trm-vault/topics/charlie/michigan-flight-museum/trm-ingest/curator-decisions-final.json`,
   matching the schema used by willow-run's version: `batch_id`,
   `curator_review_complete`, `timestamp`, `total_photos`, `decisions[]`
   (each `{photo_id, decision, topics, confidence, verified}` — drop the
   `notes` field or keep it, processor script ignores unknown fields).
   Also fold in `IMG_2221.MOV` (video, was explicitly skipped by batch 4
   agent) — decide separately whether to include as a reject/skip entry or
   handle as its own media type; not yet decided.
3. Run
   `node C:\dev\src\harvester\external\curator-decision-processor.mjs --decisions=<path to curator-decisions-final.json>`
4. Run the `/research-questions michigan-flight-museum`-equivalent (skill at
   `C:\dev\skills\research-questions\SKILL.md`) — first run `scan-gaps.mjs`,
   then per-question triage, then `update-focus-areas.mjs`.
5. Fold in the 5 transcript `.txt` files as additional sources — the
   research-questions pipeline was built photo-only; transcripts are the
   "new media type" flagged as needing design work
   ([[project-trm-ingest-scale-problem-2026-07-25]]). Decide in that session
   whether to treat them as plain-text evidence sources feeding scan-gaps,
   or something else.

**Standout finds already surfaced (worth prioritizing as new TRM facts):**
- Vina Greer, Rosie the Riveter bio (IMG_2045)
- "Screwball" B-24H instrument panel, 467th BG/788th BS, shot down over
  Melsbroek Belgium Jan 1 1945 (Operation Bodenplatte) (IMG_2059)
- Dr. John A. Clark, 100th Bombardment Group / 8th Air Force airman, later
  U-M Professor Emeritus (IMG_2090/2091) — flagged new-fact
- WWII Link Trainer flight simulator exhibit (IMG_2077-2080) — flagged new-fact
- Doolittle Raid USS Hornet CV-8 model + 2013 Final Salute ceremony items
  (IMG_2085-2087)
- Michigan Historic Site marker full text for Willow Run (IMG_2081)
- RF-84F Thunderflash confirmed via placard (IMG_2195), tail 0-27421, Michigan ANG

**After MFM is fully closed out:** do NOT start Benson Ford with the same
per-photo-agent approach — see
[[project-trm-ingest-scale-problem-2026-07-25]] for the required
architecture rethink first (Benson Ford is mostly doc-photos, needs
OCR-first path, and is bigger than MFM).

**Process note this session:** background agent hang went undetected for 9+
hours until the user asked directly — see
[[feedback_check_background_agents_for_hangs]]. Poll proactively next time.
