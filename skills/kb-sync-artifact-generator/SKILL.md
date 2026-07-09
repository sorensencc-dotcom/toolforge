---
name: kb-sync-artifact-generator
description: Generate an interactive KB sync dashboard with impact scoring, actionable recommendations, and click-to-filter charts. Parses broken links and creates a self-contained HTML artifact with sortable table, Chart.js visualization, and copy-friendly shell commands. Features impact scoring (color-coded by reference count), 5-category recommendations with copy buttons, click-to-filter chart, Grid.js searchable table, CIC design system, dark/light theme, WCAG AA accessible. Triggers on "generate KB sync report", "visualize broken links", "KB dashboard", "sync results".
compatibility: |
  - Python 3.10+
  - Access to C:\dev\cic-os\personal-knowledge-base/
  - Chart.js and Grid.js (loaded from CDN)
---

# KB Sync Artifact Generator

## What this skill does

This skill automates the workflow of running a knowledge base sync, parsing the results, and generating an interactive, production-ready HTML artifact that persists in Cowork. Includes impact scoring, actionable recommendations, and category filtering.

### Key features — Phase 1

- **Impact Scoring** — Color-coded by reference count (🔴 HIGH 5+, 🟠 MEDIUM 2-4, 🟢 LOW 1). Shows which broken links affect the most files.
- **Actionable Recommendations** — Specific fix suggestions for each issue category with copy-friendly shell commands. Priority-coded (HIGH/MEDIUM/LOW).
- **Category Quick-Filter** — Click chart bars to instantly filter the broken links table. Shows active filter with clear option.
- **Sortable & searchable table** — Grid.js table sorted by impact, searchable across all fields, paginated
- **Interactive charts** — Category breakdown with visual severity indicators
- **Dark/light theme** — CIC design system (Playfair Display, Baskerville, Ember/Brass/Sage palette)
- **Persistent artifact** — Opens in Cowork sidebar, updates on each nightly run

## Usage

### Run manually

```
I want to generate an interactive KB sync report.
```

The skill will:
1. Change to `C:\dev\cic-os\personal-knowledge-base/`
2. Execute `python3 sync-all.py` (both stages: sync + integration)
3. Parse the resulting JSON reports from `_integration/`
4. Generate an interactive HTML artifact
5. Create/update the persisted artifact in Cowork
6. Return a summary of findings

### Integrate with nightly task

To make this generate automatically every night:

Update the `kb-sync-nightly` scheduled task definition to invoke this skill instead of calling `sync-all.py` directly. The skill will run the sync, generate the artifact, and return.

## How the artifact works

### Broken Links Table

Displays all 108+ broken links with:
- **Source file** — Which doc contains the broken link (e.g., `reference/architecture.md`)
- **Target** — What the link points to (e.g., `../roadmaps/unified-roadmap.md`)
- **Category** — Reason for breakage: missing roadmap, missing operations doc, external reference, template variable, etc.
- **Severity** — How many docs reference the same missing target (high if 5+)

Sortable columns. Search box filters across all fields in real-time.

### Issues Chart

A bar chart showing breakdown by category:
- Missing roadmaps (unified-roadmap.md, cic-roadmap.md)
- Missing operations docs (monitoring.md, running.md, sealing.md)
- Missing architecture docs (overview.md, routing.md, drift.md)
- External/source code references
- Template variables (unresolved)

Click on chart segments to filter the table.

### Drill-Down Sections

For each category, an expandable section showing:
- Which files are affected
- The actual broken links
- Recommended fixes (e.g., "Create docs/roadmaps/unified-roadmap.md")

### Cross-Reference Summary

Wiki→docs mapping with:
- Which wiki pages are linked to which docs
- Topic overlap stats
- Potential duplicate groups (high similarity)

## Technical details

### Input

- Base directory: `C:\dev\cic-os\personal-knowledge-base/`
- Reports parsed:
  - `_integration/sync-report.json` — Broken links, case issues, recommendations
  - `_integration/report.json` — Duplicates, cross-refs, summary stats

### Output

Generates:
1. **HTML artifact** (self-contained, ~50 KB)
   - Inline CSS (CIC design system, dark theme default)
   - Inline JS (Chart.js and Grid.js via CDN)
   - Embedded JSON data from sync reports
2. **Persisted artifact in Cowork** (id: `kb-sync-interactive`)
3. **Static HTML file** saved to `_integration/kb-sync-interactive-report.html`

### Libraries

- **Chart.js** (CDN) — Category breakdown chart
- **Grid.js** (CDN) — Sortable broken links table
- Custom JS — Search, filter, drill-down, theme toggle

## Workflow

1. **Invoke the skill** — "Generate an interactive KB sync report"
2. **Skill runs sync** — Executes `sync-all.py` (Stage 1: wiki sync, Stage 2: integration)
3. **Parse reports** — Reads JSON outputs from `_integration/`
4. **Build artifact** — Generates interactive HTML with tables, charts, search
5. **Update Cowork artifact** — Creates or updates persisted artifact
6. **Return summary** — Shows key metrics and top issues

## Example output

The artifact displays:

```
Knowledge Base Sync — Interactive Report
Run: July 8, 2026 | Status: Complete

Summary
—
Pages Scanned: 198 | Broken Links: 108 | Issues Found: High

Broken Links Table (sortable, searchable)
—
Source File | Target | Category | Severity
reference/architecture.md | ../roadmaps/unified-roadmap.md | Missing Roadmap | 5 refs
api/autonomy.md | index-unified.md | Missing Roadmap | 3 refs
...

Issues by Category (interactive chart)
—
Missing Roadmaps: 35
Missing Operations: 18
Missing Architecture: 15
External References: 28
Template Variables: 12

Drill-Down: Missing Roadmaps
—
Affected files: architecture.md, autonomy.md, integration-guide.md
Recommendation: Create docs/roadmaps/unified-roadmap.md and docs/roadmaps/cic-roadmap.md

Cross-References (Wiki→Docs)
—
Wiki page | Linked Docs | Topic Overlap
2-merge-candidates-review.md | 12 docs | 0.92 similarity
3-topic-dependency-graph.md | 8 docs | 0.85 similarity
```

## Automation

To run this as part of nightly sync:

**Option 1: Update task to invoke skill**
```bash
claude -p "Run the kb-sync-artifact-generator skill to generate an interactive sync report"
```

**Option 2: Manual invocation**
```
Generate an interactive KB sync report with sortable broken links table and charts.
```

Both approaches update the persisted artifact, so the latest report is always available in Cowork.

## Troubleshooting

**Artifact not updating?**
- Check that `sync-all.py` completed successfully (look for `_integration/sync-report.json`)
- Verify the artifact ID in Cowork is `kb-sync-interactive`
- Regenerate with fresh run

**Charts not loading?**
- Ensure internet access for CDN (Chart.js, Grid.js)
- Check browser console for CORS errors
- Verify JSON data format in `_integration/report.json`

**Search not working?**
- Refresh the artifact (reload in Cowork)
- Check that broken links table has data (sync must have found issues)
- Try searching on a known filename (e.g., "architecture")

## Notes

- Dark theme is default (CIC design system); light theme available via toggle
- Artifact is self-contained — no external dependencies except CDN libraries
- Static HTML file also saved for offline sharing/archival
- All data is embedded in HTML (no network calls after load)

