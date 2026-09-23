# Mobile → Drive processes

Two inbound paths. Same parent folder. Different contracts. Desktop ingest is the only closer.

**Parent:** `TRM-Research`  
`https://drive.google.com/drive/folders/1ZoMRjpJ_EDq7CZ8OzvzKN02mtWj3fK1I`

| Path | Folder | Who writes | Desktop closer |
|---|---|---|---|
| A — GAP research | `03_grok_completed/` | You, from phone Drive | `node scripts/trm-ingest-drive.mjs` in `C:\dev\kb-sync` |
| B — Conversation drop | `mobile-inbox/` | Grok `drive-it` skill | Desktop `catalog_ingest` / whatever you wire to that tray |

Do not mix contracts. A finding file is not a conversation drop. A conversation drop is not a GAP card.

---

## A. GAP research (existing playbook)

Source of truth on Drive: `TRM-Research/MOBILE-PLAYBOOK.md`

### Layout

| Folder | Role |
|---|---|
| `01_actionable_gaps/` | Open GAP cards (`GAP-NN.md`) |
| `02_reference_context/` | Context packs (`GAP-NN-context-pack.md`) |
| `03_grok_completed/` | Findings land here |
| `04_archive/` | Ingest moves completed cards here |
| `_locks/` | Optional claim files (`GAP-NN.lease-grok`) |

### Phone steps

1. Drive app → `TRM-Research`.
2. Read `01_actionable_gaps/GAP-NN.md` and `02_reference_context/GAP-NN-context-pack.md`.
3. Optional: empty file `_locks/GAP-NN.lease-grok`.
4. Research in Grok / Copilot with citations.
5. Upload to `03_grok_completed/` as `GAP-NN-findings.md` with this frontmatter:

```yaml
---
gap_id: GAP-01
agent_origin: grok
agent_version: grok-mobile
source_type: web
verdict: CONFIRMED
verification_status: inferred
provenance_type: remote_agent_finding
not_primary_evidence: true
ready: true
---
```

6. Body: findings + citations. `ready: true` is the ingest signal (or sibling `GAP-NN-findings.ready`).

### Desktop

```
cd C:\dev\kb-sync
node scripts/trm-ingest-drive.mjs
```

Adapter: debounce → append evidence to `wiki/research/rfc-gap-NN-*.md` → move card to `04_archive/completed/` → release lock → review queue (`node scripts/trm-review-queue.mjs`).

---

## B. Conversation drop (`drive-it`)

Grok skill. Lands a dated markdown file in `mobile-inbox`. Does **not** run ingest.

**Folder:** `TRM-Research/mobile-inbox`  
`https://drive.google.com/drive/folders/1Faya0q0j3S62NGq_U-nxrefwbwfGQq0g`  
`folder_id`: `1Faya0q0j3S62NGq_U-nxrefwbwfGQq0g`

### From Grok (iOS or desktop)

```
drive-it cic
drive-it cic <short-title>
drive-it map <slug> to <folder-id-or-url>
```

Only `cic` is mapped today. Other slugs (`spec`, `rewrite`, `trm`, `kb`, `default`) stay `UNSET` until mapped.

### File contract

Name: `YYYY-MM-DDTHHMMSSZ__<topic>__<slug>.md`

Frontmatter written by the skill:

```yaml
---
source: grok
skill: drive-it
topic: cic
title: <title>
created: <ISO-8601>
folder_id: 1Faya0q0j3S62NGq_U-nxrefwbwfGQq0g
status: drop
---
```

Body: Context / Payload / Next. No secrets, no Plaid, no system prompts.

### Desktop

Not defined by this skill. You own how `mobile-inbox` is consumed (`catalog_ingest` or a sibling of `trm-ingest-drive.mjs`). Until that adapter exists, files sit in the tray.

---

## Which path

| Intent | Path |
|---|---|
| Close a numbered GAP with cited research | A → `03_grok_completed/` |
| Park this Grok thread / decision for later ingest | B → `drive-it cic` → `mobile-inbox/` |
| Map another topic folder | `drive-it map spec to <url>` |
| Run ingest from the phone | Neither. Desktop only. |

---

## Status (2026-09-22)

| Item | State |
|---|---|
| Path A playbook | VERIFIED on Drive |
| Path A desktop closer | VERIFIED: `kb-sync` `trm-ingest-drive.mjs` |
| Path B folder + skill map | VERIFIED |
| Path B desktop closer | UNKNOWN — your side |
| `spec` / `rewrite` / `trm` / `kb` maps | UNSET |
