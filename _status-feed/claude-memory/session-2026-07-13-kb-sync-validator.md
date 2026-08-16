---
name: session-2026-07-13-kb-sync-validator
description: Staging Markdown Validator shipped for KB-Sync v1.1 — lints staging snapshots before wiki synthesis
metadata: 
  node_type: memory
  type: project
  milestone: KB-Sync v1.1
  originSessionId: 7ff5e352-f85c-43ac-bb5b-ae0ab17e4000
---

# Session 2026-07-13: Staging Validator Feature

**Milestone:** KB-Sync v1.1  
**Date:** 2026-07-13  
**Commit:** main#a29fef6  
**Status:** ✅ Shipped

## What Shipped

New module `modules/wiki/validate-staging-docs.mjs` + npm script `wiki:validate-staging`:
- Lints kb-sync staging snapshots (or live wiki dir) for broken markdown links, unresolved `[[wiki-links]]`, malformed escapes, code-fence exclusion
- Resolves links against current wiki page registry
- Detects name collisions (ambiguous wiki-link targets)
- Handles root-relative paths (`/wiki/Index.md`), decodeURIComponent crashes, directory validation
- Exits 0 (warnings only) or 1 (errors) — ready for pre-synthesis gate integration
- Standalone, no external dependencies

**Real run result:** 47 staging files scanned, 5 genuine broken links flagged (2 template placeholders, 3 dead refs in `docs/targets/`), 274 warnings (mostly illustrative examples in docs after code-fence exclusion fix).

## Design Decisions

**Code fence exclusion:** Template/lint-rules docs use illustrative `[[Example]]` and `[fake](./link.md)` syntax in markdown examples. Stripping triple-backtick blocks prevents false positives in scan. **Why:** templates must be readable examples, not error-free code.

**Registry collisions as warnings, not errors:** Multiple pages with same basename (kb-sync/index.md + obsidian/index.md both → `index`) don't break validation, just flag ambiguity. **Why:** Obsidian vault structure naturally has scoped indexes; hard-failing would require flattening or renaming.

**Warnings for `[[wiki-links]]`, errors for markdown links:** Wiki-link resolution against current registry is aspirational (post-synthesis, more pages exist); markdown relative links are filesystem facts (file exists or doesn't). **Why:** Different confidence levels match the staging→synthesis workflow.

## Code Review Fixes (6 findings)

1. **L22-23 `repoRoot()` try/catch** — git command errors now caught, logged cleanly via `logError()`.
2. **L66-67 Registry collision detection** — changed from `Map<string, string>` (first-seen-wins) to `Map<string, string[]>` (tracks collisions, warns on ambiguous).
3. **L72,93 Code-fence stripping** — regex-scan now excludes triple-backtick blocks (reduced false-positive warnings 295→274 on real staging).
4. **L98 Safe `decodeURIComponent()`** — malformed %-sequences (e.g., `./100%.md`) caught in try/catch, fall back to raw target. **Why:** broken %-escapes would crash the entire scan.
5. **Root-relative link resolution** — leading `/` paths now resolve against repo root, not current dir (filesystem semantics).
6. **L124-126 Directory validation** — `fs.statSync(...).isDirectory()` check before walk prevents ENOTDIR crash if a file path is passed.

## Patterns

- **Lenient config parsing:** Mirrors `ingest-wiki.sh`'s regex-based approach (tolerates `key: value`, `key=value`, inline `# comment`, raw Windows paths). **Why:** coordinated with existing bash scripts, no YAML library needed, survives malformed YAML.
- **Warnings vs. errors:** Soft warnings (missing heading, unresolved wiki-links) don't block; hard errors (broken file paths) exit 1. **Why:** staging may be incomplete/aspirational, filesystem facts are blocking.
- **Standalone script:** No wiring into `ingest-wiki.sh` `validate` action. **Why:** user chose lowest-risk, testable-in-isolation approach.

## Next Steps

1. **Wire into pipeline:** Optional — can integrate into `ingest-wiki.sh`'s `validate` action or pre-commit hook when ready.
2. **Fix broken refs in docs/targets/:** 3 dead links found (RewriteMCP.md, PhaseSystem.md, ConcurrentState.md). Backlog task.
3. **Formalize KB-Sync v1.1 milestone:** Create `.planning/ROADMAP.md` with phases if pursuing formal milestone tracking.

## Learnings

**Why staging validation matters:** Staging is the audit trail. Broken links in staging cascade into the wiki synthesis layer, then into operational docs. Catching them early (before Claude ingest) saves 3-4 iteration cycles of broken-link discovery and repair.

**Collision detection as a data smell:** When kb-sync/index.md and obsidian/index.md both exist, the registry collision isn't a bug — it's a signal that your vault has scoped structure, not flat. Naming convention (entity/concept namespacing) would lock this in.

**Code fence handling unlocked real-world runs:** Initial test had 295 warnings. After stripping fenced examples, 274 warnings (and same 5 real errors). The 21-warning drop reveals the tool works; the remainder are aspirational doc links (expected, not actionable).

---

**Retro logged:** 2026-07-13, main#a29fef6. Ready for KB-Sync v1.1 formal milestone closure if ROADMAP.md is set up.
