---
name: project-family-history-business
description: "Family History Research Business — Phases 50–54 complete, pipeline end-to-end, revenue trigger unlocked. Phase 55 (interviews) and 56 (portal) remain."
metadata: 
  node_type: memory
  type: project
  originSessionId: 70c2ba25-27a8-4049-880c-0fbb3c107492
---

Premium personalized family history research business ($2,500–$8,500/project) built on the CIC documentary pipeline. The documentary's success is the marketing narrative and proof of concept.

**Core positioning:** "We built an AI-powered research pipeline to make a documentary. Now we use it to find your family."

**Why:** Documentary validates methodology; infrastructure already built for CIC and repurposed dual-use with `-Domain genealogy` flag.

**Service tiers:** Archive Digitization ($1,500 flat) / Discovery ($2,500) / Standard ($5,000) / Premium ($8,500).

**Revenue target:** $85K Year 1 (19 projects), $200K+ Year 2.

**How to apply:** When building CIC archival scripts, always add `-Domain documentary|genealogy` flag pattern. Same code, two pipelines.

## Phase Status (as of 2026-06-07)

| Phase | Name | Status | Key file |
|-------|------|--------|----------|
| 50 | OCR Pipeline | ✅ COMPLETE | `ocr-cic-documents.ps1` — Tesseract + WinRT fallback, 15 doc types |
| 51 | Genealogy Taxonomy | ✅ COMPLETE | `classify-cic-media.ps1` — 13 genealogy types, 5-tier significance |
| 52 | Entity Relationship Graph | ✅ COMPLETE | `build-entity-graph.ps1` — 14 seed facts, vital record parser, GEDCOM export |
| 53 | Archive API Layer | ✅ COMPLETE | `query-archives.ps1` — 10 connectors, 4 live APIs |
| 54 | Report Generator | ✅ COMPLETE | `generate-report.ps1` — HTML→PDF, exec summary, timeline, evidence register, gap analysis, live archive integration (`-RunArchiveQuery`) |
| 55 | Interview Pipeline | 🔲 NEXT | Whisper transcription → segment extraction → research log integration |
| 56 | Client Portal | 🔲 Pending | Scoped access, expiring links, audit trail |

**Pipeline is end-to-end.** Revenue trigger unlocked — first paying client possible now at $2,500 Discovery tier.

## Also completed this session (2026-06-07)

- **CIC git repo initialized** — `C:\CIC_MEDIA_LIBRARY\CIC\.git` — 37 files in initial commit, `.gitignore` excludes media files and credentials
- **SecurityValidator 9 failing tests fixed** — Windows path normalization, prompt matching, `toContain` → `toEqual(arrayContaining)` Vitest API fix
- **Global permission-audit skill** — `C:\Users\soren\.claude\skills\permission-audit.md`; invoke to scan transcripts and update allowlist
- **Global allowlist cleaned** — 44 rules, one-time entries removed, `PowerShell(cd *)` added (399 hits)

## Phase 53 Archive Connectors

10 connectors in `C:\CIC_MEDIA_LIBRARY\CIC\scripts\archive-connectors\`:

**Live APIs (no setup):** LOC, ChronAmerica, Smithsonian, InternetArchive

**Need credentials:** FamilySearch (free OAuth — register at familysearch.org/developers), Ancestry (partner program)

**Institutional stubs (research links + contacts):** BensonFord (`research@thehenryford.org`), NARA (RG 179/18/342), Rigsarkivet (Danish archives — critical for Sorensen birth/emigration, Odense parishes), BurtonDPL (Detroit Public Library Burton Collection + ALUA Reuther Library)

Credentials template: `C:\CIC_MEDIA_LIBRARY\CIC\metadata\archive_credentials.json`

## Key Documents

- Business plan: `C:\dev\rewrite-mcp\docs\cic\FAMILY_HISTORY_BUSINESS_PLAN.md`
- Roadmap: `C:\dev\rewrite-mcp\docs\cic\CIC_MASTER_ROADMAP.md` (Phase 50+ table at bottom)
- Scripts: `C:\CIC_MEDIA_LIBRARY\CIC\scripts\`
- Entity graph output: `C:\CIC_MEDIA_LIBRARY\CIC\metadata\entity_graph.json`
- Archive results: `C:\CIC_MEDIA_LIBRARY\CIC\metadata\archive_results_latest.json`
