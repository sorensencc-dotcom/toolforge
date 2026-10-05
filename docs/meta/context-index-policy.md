# Context index policy

**Version:** 1.1
**Status:** Active
**Owner:** Governance
**Last reviewed against code:** 2026-10-05

## Purpose

Keep agent context small. `agent-scan.ignore` lists files that stay in Git but add noise to agent scans.

## Two-file model

| File | Purpose |
|------|---------|
| `.gitignore` | Excludes files from version control. |
| `agent-scan.ignore` | Excludes files from agent context loads. Files stay tracked in Git. |

`agent-scan.ignore` is a plain list of paths and globs with `#` comments. It does not stop tools that ignore it. The Everything `es` CLI indexes every file on disk, so add `!` exclusions to `es` queries instead.

## Current categories

Read `agent-scan.ignore` for the authoritative list. At the 2026-10-05 review it groups entries as:

| Category | Examples |
|----------|----------|
| Generated directories | `node_modules/`, `.claude/worktrees/`, `.venv/`, `_kb-sync-staging/`, `dist/`, `build/`, `coverage/` |
| Auto-regenerated reports | `audit/COWORK-*.md`, `dashboard.html`, `skills/SKILLPACK-*.md` |
| Archives and backups | `*.bak`, `*.backup`, `archive/` |
| Temporary and session data | `.context/retros/`, `.session-*`, `*.tmp` |
| Vendor lock files | `package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`, `Gemfile.lock` |
| Large generated data | `*.db`, `*.sqlite`, `*.log` |
| Tool cruft | `.DS_Store`, `Thumbs.db`, `*.swp`, `*.swo`, `*~` |

## Lock file caveat

`.gitignore` also lists `package-lock.json`, `yarn.lock`, and `pnpm-lock.yaml`, yet 33 of them are tracked (about 4.4 MB at the 2026-10-05 review), because they were committed before the ignore rule or force-added. Ignoring them in agent scans works; the `.gitignore` rule does not untrack them. Run `git ls-files | grep -E '(package-lock\.json|yarn\.lock|pnpm-lock\.yaml)$'` to list them.

## Refresh cycle

**Trigger:** each phase charter that adds generated directories or a new package.

To refresh:

1. Find generated directories that `agent-scan.ignore` does not cover (nested `node_modules/`, new `dist/` outputs).
2. Find entries whose paths no longer exist, and remove them.
3. Commit the change with the phase work.

No script automates this check. An earlier version of this policy contained PowerShell pseudocode for it; that pseudocode never shipped.

## Rules

1. Use glob patterns, not machine-specific paths. Write `**/node_modules/`, not an absolute path.
2. Group every entry under a comment that says why it is excluded (generated, temporary, vendored, noisy).
3. Never delete `.gitignore` entries to make room. Move the entry to `agent-scan.ignore` when the file must stay tracked.
4. Measure before claiming savings. Earlier versions of this policy projected an 11% discovery-time cut and 8-15 KB per week; no measurement backs those figures, so this version drops them.

## Related

- `agent-scan.ignore`: the exclusion list.
- `docs/meta/skill-operator-guide.md`: context consolidation for skill docs.
- `scripts/intercept-grep.js`: blocks broad workspace greps that bypass the indexes.
