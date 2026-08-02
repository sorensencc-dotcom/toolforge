---
title: "TRM sync-treatment: factKey bugfix + daily automation"
date: 2026-08-01
status: DRAFT
---

# TRM sync-treatment: factKey bugfix + daily automation

## Context

`trm sync-treatment` (shipped 2026-07-29, see `memory/session-wrap-2026-07-29-sync-treatment-shipped.md`)
reconciles TRM vault topic extracts into the CIC documentary treatment doc.
`TODOS.md` still lists it as an open backlog item — stale, the CLI already
ships and is on `trm` main. Two follow-ups from that ship remain real:

1. `benson-ford` extract has factKey collisions the tool correctly refuses to
   silently merge, topic skipped pending investigation.
2. `michigan-flight-museum` had no `extracts/extract.json` — since resolved
   (extract.json now present, topic syncs clean per dry-run 2026-08-02).

A dry-run against the real vault (`node trm/dist/cli/index.js sync-treatment
--dry-run`) reconfirmed benson-ford still flags 10 factKey collision pairs.

## Root cause: factKey false positives

`trm/src/sync/factIdentity.ts` `normalize()`:

```ts
return text.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
```

Strips everything outside `[a-z0-9\s]`. Any fact whose text is punctuation-only
or non-Latin-script (OCR noise from scanned documents — Arabic, Greek,
Cyrillic fragments, bare `"`, `%`, `.`) normalizes to `""`. `factKey` hashes
`source_id + normalize(text)`, so two completely different fragments from the
same source (e.g. `"` and `реакто`) collide on the same key even though their
real text differs entirely.

Inspected all 10 benson-ford collision pairs directly:
- Genuine near-dupes (case/punctuation-only difference of otherwise-identical
  text): `"Sorenson, C. cont."` / `"Sorenson, C. Cont."`, `"Box 68"` /
  `"BOX 68"`, `"Top"` / `"TOP"`, `"Manager"` / `"Manager."` — correctly
  flagged, should keep colliding.
- False positives caused by the empty-normalize bug: `"` / `.`, `%` /
  `"реакто"`, and the `"1"` / `"#1"` / `"\"1"` cluster — different raw text,
  wrongly forced into the same key.

## Fix

In `factKey`, when `normalize(text)` is empty, fall back to the raw trimmed
text as the key material instead of `""`, so distinct non-normalizable
fragments stay distinct per source. Normal (non-empty) normalization is
unchanged, so genuine dupes still merge exactly as before.

```ts
export function factKey(fact: { source_id: string; text: string }): string {
  const normalized = normalize(fact.text);
  const keyText = normalized.length > 0 ? normalized : fact.text.trim();
  return crypto.createHash('sha256').update(`${fact.source_id}|${keyText}`).digest('hex');
}
```

Tests (unit, `trm/tests`): 
- two facts, same source, both normalize to `""`, different raw text → different keys.
- two facts, same source, both normalize to `""`, identical raw text → same key (still dedupes true exact-repeat garbage).
- existing case/punctuation dedup behavior unchanged (regression check).

Verification: re-run `sync-treatment --dry-run` against the real vault after
the fix; benson-ford should drop from 10 collisions to the ~4 genuine ones,
zero false positives remaining. Confirm via manual inspection of remaining
pairs (same check performed during design).

## Daily automation

Mirrors the existing `scripts/daily-report-agent.ps1` +
`scripts/setup-daily-report-schedule.ps1` pattern (Windows Scheduled Task,
already proven in this repo for the Morning Ingestion / daily report flows).

**`scripts/trm-sync-treatment-agent.ps1`**
- Runs `node trm/dist/cli/index.js sync-treatment --dry-run` first (all
  topics) from the real vault root, parses the report for: new facts count
  per topic, skipped topics + reasons, factKey collisions.
- If new facts exist and no collisions/skips are new since last run, re-runs
  without `--dry-run` to commit the reconciliation.
- Appends a dated bullet to `TODOS.md` under a `## Automated: TRM sync-treatment`
  section summarizing the run (new facts, skips, collisions) — only when
  there's something to report (no-op runs don't spam the file).
- Writes a memory file (`memory/session-wrap-<date>-trm-sync-treatment-auto.md`)
  with the same summary, following the existing memory frontmatter convention.
- Logs to `C:\dev\logs\trm-sync-treatment-*.log`, same as `daily-report-agent.ps1`.

**`scripts/setup-trm-sync-treatment-schedule.ps1`**
- Registers Windows Scheduled Task `toolforge-trm-sync-treatment`, daily
  06:30 (after the 06:00 morning ingestion task), admin-gated, same
  `New-ScheduledTaskAction`/`-Trigger`/`-Settings` shape as
  `setup-daily-report-schedule.ps1`. `-Force` flag to re-register.
- Registration itself is a real system change (modifies Task Scheduler) —
  run only with explicit user go-ahead, not part of the automated build.

## TODOS.md

- Mark the `TRM-scan-to-treatment sync skill` line `[x]`, noting: CLI shipped
  2026-07-29 (already true), michigan-flight-museum resolved, benson-ford
  factKey bug fixed this session, daily automation added (scripts written;
  schedule registration pending explicit approval).

## Out of scope

- Actually registering the scheduled task (requires admin + explicit user
  confirmation, done as a separate step after this spec's code lands).
- Any change to `matchFact`/`matching.ts` beyond what `factIdentity.ts`
  already feeds it — out of scope unless the fix surfaces a second-order bug
  there (not observed in current testing).
