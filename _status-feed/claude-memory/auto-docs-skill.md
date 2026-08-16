---
name: auto-docs-skill
description: Auto-discover and update ALL relevant documentation from git changes; zero-prompt batch writes
metadata: 
  node_type: memory
  type: reference
  originSessionId: 6808a1c8-2869-4006-a21c-7beae1f15e65
---

## auto-docs Skill

**Location:** `C:\Users\soren\.claude\skills\auto-docs.md` (also: `c:\dev\rewrite-mcp\skills\auto-docs\index.js`)

**Invocation:** `/auto-docs` (slash command) or `node rewrite-mcp/skills/auto-docs/index.js`

**Status:** ✅ Enhanced — now captures ALL changes automatically

### What It Does

Fully automated documentation sync from git changes:

1. **Detect** — `git diff HEAD~1..HEAD` to identify all changes
2. **Categorize** — Map file types to categories (code, phase, schema, operations, dependencies)
3. **Capture All** — Always write to CHANGELOG.md (create if missing)
4. **Structure** — Add timestamp, categories, file list to changelog entries
5. **Preserve** — Keep existing doc content (prepend to CHANGELOG, append elsewhere)
6. **Stage & Commit** — Atomic git operations with auto-generated commit message
7. **Report** — Detailed summary with counts, hash, warnings, next steps

### Change Categories

| Category | Trigger | Docs Updated |
|----------|---------|--------------|
| `code` | `*.ts`, `*.js` | `CHANGELOG.md` |
| `phase` | Path contains "phase" | `CHANGELOG.md`, `CIC_MASTER_ROADMAP.md` |
| `schema` | Path contains "schema" or `*.json` | `docs/SCHEMAS.md` |
| `dependencies` | `package.json` | `README.md` |
| `operations` | Path contains "script" | `README.md` |

### Usage

```bash
/auto-docs
```

Automatically detects and syncs all relevant docs based on last commit.

### Permission Bypass

Zero-prompt operation via pre-configured PowerShell rules in `~/.claude/settings.json`:
- `PowerShell(Set-Content *)`
- `PowerShell(Out-File *)`
- `PowerShell(New-Item -ItemType File *)`

### Returns

```json
{
  "success": boolean,
  "results": {
    "changes": ["file1.ts", "file2.ts"],
    "categories": ["code", "phase"],
    "docs": [{ "path": "CHANGELOG.md", "status": "updated" }],
    "git": { "staged": 2, "commit": "abc123def" },
    "report": "Session summary with checklist"
  }
}
```

### When to Use

- After implementing a phase to auto-sync roadmaps
- After major code refactors to update CHANGELOG
- When batch-documenting multiple changes at once
- To ensure docs stay in sync with code without manual updates
