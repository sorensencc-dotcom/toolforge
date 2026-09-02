# Knowledge Base Sync (kb-sync-nightly) — Usage Guide

**Version:** 1.0.1  
**Maintained:** Active  
**Type:** Operational Skill  
**Fixed:** 2026-07-13 (path correction)

---

## Quick Start

```bash
cd C:\dev\kb-sync
npm run kb:sync:all
```

## What It Does

Orchestrates a multi-stage npm pipeline:

### Stage 1: NotebookLM Sync
- Pulls latest NotebookLM data via MCP server
- Stages raw sources in `_kb-sync-staging/` (timestamped)

### Stage 2: Obsidian Sync
- Ingests staged docs from `obsidian/vault/`
- Validates staging manifest integrity
- Generates ingest prompts for wiki synthesis

### Stage 3: Artifact Generation
- Scans staging + wiki content
- Builds interactive HTML report with impact scoring
- Generates searchable recommendations

## Output Files

### After `npm run kb:sync:all`:

```
C:\dev\kb-sync/
├── obsidian/vault/
│   ├── wiki/
│   │   ├── index.md           # ← Master TOC
│   │   └── (entity pages)
│   └── _kb-sync-staging/
│       └── kb-sync/
│           └── <YYYYMMDD-HHMMSS>/   # ← Raw staging (immutable)
│               └── FILES.manifest.txt
├── _integration/
│   └── kb-sync-interactive-report.html  # ← Interactive artifact
└── .validation-report.json   # ← Validation results
```

### Key Files to Review

| File | Purpose | Use Case |
|------|---------|----------|
| `_integration/kb-sync-interactive-report.html` | Interactive dashboard | Impact analysis, recommendations |
| `obsidian/vault/wiki/index.md` | Master documentation index | Team reference, onboarding |
| `.validation-report.json` | Staging validation results | Pipeline health check |

## Running Specific Stages

```bash
# Full pipeline (NotebookLM + Obsidian + artifact)
npm run kb:sync:all

# Obsidian staging only (faster iteration)
npm run kb:sync:obsidian

# Validation check
npm run wiki:validate-staging

# Regenerate artifact only
npm run artifact:generate:all
```

## Automation

### Scheduled Task (Cowork)

The skill is registered as a scheduled automation:

```yaml
Skill: kb-sync-nightly
Schedule: Daily at 8:00 AM
Entry: src/run.sh
Working Directory: C:\dev\kb-sync
```

When triggered, it runs: `npm run kb:sync:all`

### Manual Schedule (Command Line)

```bash
cd C:\dev\kb-sync && npm run kb:sync:all
```

## Configuration

Edit files in `C:\dev\kb-sync/configs/`:

### Obsidian Mapping Rules (`obsidian.yaml`)

```yaml
mappings:
  rewrite-mcp/: "CIC/Rewrite Labs"
  torquequery/: "CIC/TorqueQuery"
  default: "Unsorted"
```

### Global Settings (`global.yaml`)

```yaml
limits:
  warning_threshold: 5MB
  hard_limit: 8MB
  chunk_size: 4MB
```

### Artifact Generation (`artifact-generator.yaml`)

```yaml
impact_scoring:
  min_reference_count: 1
  high_impact_threshold: 10
```

## Troubleshooting

### Error: "npm not found"
Install Node.js 18+ and npm. Then run: `npm install` in `C:\dev\kb-sync/`

### Error: "module not found"
```bash
cd C:\dev\kb-sync
npm install
```

### Artifact not generated
```bash
# Regenerate artifact separately
npm run artifact:generate:all
```

### Permission denied on staging
Ensure `C:\dev\kb-sync` and subdirectories are writable.

## Performance

- **Obsidian staging:** 10-20 seconds
- **Artifact generation:** 5-10 seconds
- **Full pipeline:** 30-60 seconds (all stages)

## Support

- **Skill Status:** See `SKILL.md` in this directory
- **Architecture:** See `INTEGRATION_DIAGRAM.md` in this directory
- **Configuration:** See inline comments in `configs/` files
