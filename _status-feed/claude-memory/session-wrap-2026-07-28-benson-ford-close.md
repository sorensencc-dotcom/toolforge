---
name: session-wrap-2026-07-28-benson-ford-close
description: "Benson Ford ingest fully closed (256/256 real Vision OCR), retro on why it was slow, 3 new backlog items opened for next session(s)"
metadata: 
  node_type: memory
  type: project
  originSessionId: 5a743383-e073-4c39-b97e-99ef106c56fc
  modified: 2026-07-28T12:23:06.202Z
---

Closes [[project-benson-ford-batch1-closed-2026-07-27]]. All 256 Benson Ford
HEIC files real-ingested into `charlie/benson-ford`, `trm validate` clean.

## Retro: what worked

- Batching in 50s with a check-in after each batch caught real problems early
  (413 body-limit batch1, then 5s OCR timeout batch2) instead of a single
  giant run failing opaquely at file #180.
- Content-hash dedup (`manifestStore`) + `--retry-failed` made restarts free —
  never had to re-run a file that already succeeded, never had to think about
  which files were "done" by hand.
- Fixing root cause (OCR timeout 5s->90s) instead of just retrying blind paid
  off immediately: batch2's 3 failures were the *first* batch, every batch
  after had a small, cheap failure tail (0-3 files) instead of a growing one.

## Retro: why this took way too long, and what to change

1. **Rediscovery tax was ~40% of the session.** Prior-session memory pointed
   at a source path (`research-data/raw/Benson-Ford`) that had been emptied
   and refilled by the user mid-session, at a vault staging structure that
   had to be reverse-engineered from directory contents (no README/pointer
   file in the vault itself), and at CLI invocation details (root = cwd not
   repo, `TRM_ACTOR` env var, git-root refusal) that weren't written down
   anywhere and had to be hit as runtime errors one at a time. **Fix:** the
   TRM-to-treatment sync skill (opened below) should also emit/maintain a
   one-page "how to run ingest-dir" cheat sheet (cwd requirement, required
   env vars, dedup semantics) so this isn't re-derived by trial and error
   every session.
2. **Real Vision OCR latency was the dominant cost and was invisible until
   hit.** 5000ms was clearly a mock-tuned default, but nothing surfaced that
   until 3 files failed. **Fix:** the feedback/report skill (opened below)
   should track OCR latency percentiles across runs so timeout tuning is
   data-driven before the next large batch, not discovered mid-batch again.
3. **trm's own build was broken (`ignoreDeprecations` bad value) and its
   test suite silently depends on nothing real listening on :3000** — both
   pre-existing, both cost real time to isolate from my own changes. Neither
   was caught by CI because CI presumably doesn't run into a live dev server
   the way an interactive ingest session does.
4. Conversion (ImageMagick) + ingest were sequential per batch; could have
   pipelined batch N+1's conversion while batch N's ingest was still running
   the slow Vision calls. Didn't cost much here (256 files) but would matter
   at 1000+.

## Opened for next session(s) — see C:\dev\TODOS.md

- **TRM-to-treatment sync skill** — scan all TRM topics for updates, pull
  into the CIC documentary treatment. Currently fully manual.
- **TRM feedback/report skill** — post-batch feedback pass (classifier
  accuracy, extraction quality), new-topic stubbing, web-search
  cross-verification. Currently manual and ad-hoc per batch.
- **Video ingestion plan** — no video path exists in `ingest-dir` at all
  (image and text-doc only). Needs a real plan before any code.

## Fixes shipped this session (pushed)

- `TRM` `d5f35b3..7575559`: OCR client timeout 5000ms->90000ms (retries 3->2)
  in `ingestDir.ts`; `tsconfig.json` `ignoreDeprecations` "6.0"->"5.0" (was
  blocking `npm run build` outright on installed tsc 5.9.3). 186/186 tests.
- `cic-ingestion` `07c8917c..0d0344b0`: Express JSON body limit 10mb->25mb.
