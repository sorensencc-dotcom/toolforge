# KB Sync Artifact Generator

**Interactive knowledge base sync reports with searchable tables, charts, and drill-down details.**

## Quick Start

```bash
# Manual run
claude -p "Generate an interactive KB sync report"

# Or invoke the skill directly from a session
Generate an interactive KB sync report with sortable broken links table.
```

## What it does

1. **Runs sync-all.py** — Full knowledge base sync (wiki scan + integration layer)
2. **Parses JSON reports** — Reads broken links and integration analysis
3. **Generates HTML artifact** — Interactive dashboard with:
   - **Sortable & searchable broken links table** (Grid.js)
   - **Category breakdown chart** (Chart.js)
   - **Drill-down details** by issue type
   - **Dark/light theme toggle** (CIC design system)
4. **Updates Cowork artifact** — Persisted, auto-refreshes on each run

## Features

### Broken Links Table
- Sort by source file, target, or severity
- Full-text search across all fields
- Shows which docs are affected and what's missing

### Interactive Chart
- Visual breakdown by category:
  - Missing Roadmaps
  - Missing Operations Docs
  - Missing Architecture Docs
  - External References
  - Template Variables
- Click to drill down into specific issues

### Search & Filter
- Real-time search across all broken links
- Filter by category, severity, or filename
- Find all references to a missing document

### Drill-Down Details
- Expand each category to see affected files
- View the exact broken link for each reference
- Get actionable recommendations

## Output

Generates:
- **Interactive HTML artifact** (~60 KB, self-contained)
- **Persisted Cowork artifact** (id: `kb-sync-interactive`)
- **Static HTML file** saved to `_integration/kb-sync-interactive-report.html`

## Setup

### Skill Directory Structure
```
kb-sync-artifact-generator/
├── SKILL.md              # Skill metadata & instructions
├── README.md             # This file
├── src/
│   └── index.ts          # Main implementation
├── tests/
│   └── test.ts           # Test cases
└── evals/
    └── evals.json        # Test prompts for evaluation
```

### Requirements
- Python 3.10+
- Node.js 16+ (for TypeScript compilation)
- Access to C:\dev\cic-os\personal-knowledge-base/
- Internet (for Chart.js & Grid.js CDN)

## Testing

```bash
# Run test cases (see evals/evals.json)
npm test

# Manual test
ts-node src/index.ts
```

## Integration with Nightly Sync

To make this run automatically every night:

**Update the kb-sync-nightly task:**
```bash
claude -p "Run kb-sync-artifact-generator skill to update the interactive report"
```

The skill will:
1. Run sync-all.py
2. Generate the interactive artifact
3. Update the persisted Cowork artifact
4. Return summary metrics

## Design System

Uses CIC design system:
- **Typography:** Playfair Display (headings), Baskerville (body)
- **Colors:** Ember (#8B4513), Brass (#D4AF37), Sage (#9B9B8F), Charcoal (#2C2C2C)
- **Theme:** Dark by default, light available via toggle
- **Responsiveness:** Works on desktop and mobile

## Troubleshooting

**Artifact not showing**
- Verify `sync-all.py` completed successfully
- Check `_integration/sync-report.json` exists
- Refresh Cowork sidebar

**Charts not loading**
- Ensure internet access (CDN required for Chart.js)
- Check browser console for errors
- Verify `_integration/report.json` has data

**Search not working**
- Refresh the artifact
- Check that broken links exist (sync found issues)
- Try searching with exact filename

## Future Enhancements

- [ ] Export report as PDF
- [ ] Email summary on nightly run
- [ ] Track broken link history (show when they first appeared)
- [ ] Suggest link fixes based on KB structure
- [ ] Integration with issue tracker (auto-create GH issues for high-priority breaks)

---

**Author:** Chris (CIC + Rewrite Labs)  
**Version:** 1.0.0  
**Last Updated:** July 8, 2026
