---
name: learning-codex-cli-location
description: Codex CLI is installed but not on PATH in git-bash sessions; exact binary path and a broken .bashrc that blocks fixing PATH the normal way.
metadata: 
  node_type: memory
  type: learning
  originSessionId: c3ced89e-055b-429c-9ef0-8f25abece942
  modified: 2026-07-18T18:29:04.397Z
---

Codex CLI (`codex-cli 0.144.5`) is installed at `C:\Users\soren\.codex\.sandbox-bin\codex.exe`. As of 2026-07-18, `~/.bashrc` was rewritten clean (was UTF-16LE-corrupted, see below) and now includes `export PATH="$HOME/.codex/.sandbox-bin:$PATH"` — `codex` resolves directly on PATH in new bash sessions. If a session predates this fix or PATH somehow doesn't pick it up, fall back to full path: `"/c/Users/soren/.codex/.sandbox-bin/codex.exe" exec "<prompt>"`.

**Why:** discovered during a session where `codex --version` failed and the user said "we used codex last night" — it wasn't uninstalled, just not resolvable by bare name due to the `.bashrc` corruption below.

**`.bashrc` corruption — FIXED 2026-07-18:** the file had been UTF-16LE encoded (~11 duplicate git-ai-installer appends, one truncated mid-multibyte-sequence), which made `bash -c '. ~/.bashrc'` fail with `cannot execute binary file` on every single bash command in every session. Rewritten as clean, deduplicated UTF-8. If this error reappears, check `.bashrc`'s encoding again (`iconv -f UTF-16LE -t UTF-8` to inspect) — likely re-corrupted by the same git-ai installer re-running.

**Separate, unrelated finding:** the `claude` CLI (Claude Code's own standalone npm CLI, used by `trm`'s `claudeCodeRunner` to shell out for fact extraction) does NOT exist anywhere on this machine at all — this session runs as a VSCode extension, not the standalone CLI. This is a real absence, not a PATH problem, and can't be fixed by editing `.bashrc`.
