# Workspace & Brain Storage Cleaner

Audits, detects, and safely purges stale artifacts, orphaned nested git clones, oversized execution logs, and stray temp files across Antigravity Brain and development workspaces.

## Quick Start

```bash
python scripts/clean-storage.py          # audit only
python scripts/clean-storage.py --apply  # apply cleanup
```

## What it does

- Scans `brainRoot` (default `~/.gemini/antigravity/brain`) and `workspaceRoot` (default `C:\dev`)
- Detects orphaned nested `.git` clones, oversized logs, stray temp files
- Dry-run by default; `--apply` performs the purge and reports reclaimed bytes

---

**For Setup, Requirements, Inputs/Outputs, Error Codes, Testing:** See [Skill Operator Guide](../../docs/meta/skill-operator-guide.md).
