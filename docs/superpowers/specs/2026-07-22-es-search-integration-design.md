# es (Everything CLI) Search Integration — Design

**Date:** 2026-07-22
**Status:** Approved (pending user spec review)

## Problem

c:\dev has grown large and deep (docs/archive/, .claude/worktrees/, .ijfw/, cic-vision-governance/, etc). Finding a file by name/pattern via Glob means a live directory walk across this tree — slow and token-heavy on broad or root-anchored patterns. Everything (voidtools) is already running on this machine as a background indexer (2 processes: GUI + service), keeping a live NTFS filename index via the USN journal, but its CLI client (`es.exe`) isn't installed/on PATH, so nothing uses it yet.

## Goal

Give Claude (and the user) a fast, token-cheap path for filename/path-only lookups in c:\dev, without replacing Grep/Glob for their existing jobs.

## Non-goals

- Content search — es indexes filenames/paths only, never file contents. Grep (ripgrep) remains the tool for that.
- No MCP server, no wrapper skill, no recipe library. Straight CLI, invoked via Bash, documented once.

## Architecture

No new services. Everything.exe already runs and maintains a live index. Add `es.exe` (voidtools' official CLI client) to PATH; it talks to the running Everything instance over its default IPC channel (named pipe, default instance name) and returns matches instantly — no directory walk.

**Install source:** No winget/choco/scoop available on this machine (verified 2026-07-22). Manual download from voidtools' official CLI page (voidtools.com/en-us/support/es), unzip `es.exe` into a directory already on PATH (or add its directory to PATH). This is a user-run manual step, not scripted — installing an unreviewed binary shouldn't be automated silently.

**IPC assumption:** Default Everything instance name. If the user later runs a named/non-default Everything instance, `es` needs `-instance <name>`; not needed today since only one default instance is running.

## Decision rule: es vs Glob

Use `es <pattern>` via Bash instead of Glob when either is true:
- The search has no known parent directory (would otherwise require `**/` from repo root).
- The target may live under a rarely-loaded subtree (docs/archive/, .claude/worktrees/, .ijfw/) where a full Glob walk is disproportionately expensive relative to the lookup.

Otherwise keep using Glob — it's already fast for scoped, known-subtree patterns and needs no extra binary.

## Fallback behavior

If the `es` Bash call errors (binary missing, Everything service not running, non-zero exit), explicitly retry the same lookup via Glob. This must be a stated retry step, not an assumed "silent fallback" — nothing enforces that automatically.

## Documentation change

Add a new `## Internal Search (es / Everything)` section to CLAUDE.md, placed immediately after the existing `## GBrain Search` section (both are search-tool guidance, keeping related content adjacent). Content: what es is, the decision rule above, the fallback instruction, and a note that `where es.exe` confirms availability before relying on it.

## Testing / verification

1. Confirm `es.exe` resolves on PATH (`where es.exe`) and returns results for a handful of known files/patterns in c:\dev.
2. Latency check: run an es query against a pattern under docs/archive/ or .claude/worktrees/, confirm near-instant return.
3. Token comparison: run the same lookup (e.g. `**/*.md` scoped to docs/archive/) via Glob vs `es ext:md path:docs\archive`, compare result-set size/output tokens to substantiate the "fewer tokens" claim before treating it as fact.

## Rollout

This is a tooling/workflow change, not application code — no tests-as-code, no CI. Verification is the manual steps above, done once after `es.exe` is installed.
