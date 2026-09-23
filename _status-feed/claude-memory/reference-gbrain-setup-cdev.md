---
name: reference-gbrain-setup-cdev
description: "gbrain install state on this machine for the C:\\dev monorepo — binary path, engine, MCP registration, known gaps"
metadata: 
  node_type: memory
  type: reference
  originSessionId: ff0f591f-5afe-46f6-9baa-ad69e8012108
  modified: 2026-09-08T23:14:50.112Z
---

gbrain on this machine (set up via /setup-gbrain 2026-09-08):

- **Binary**: `C:\Users\soren\.gemini\antigravity\bin\gbrain.exe` v0.47.4.0 (Antigravity-bundled, self-upgrade mode=notify; 0.48.5.0 available). NOT on Git Bash PATH by default — sh shim at `~/AppData/Roaming/npm/gbrain` execs the .exe so `gbrain` resolves in Bash. gstack `gstack-gbrain-detect` reports `no-cli` without the shim.
- **Engine**: PGLite at `C:\Users\soren\.gbrain\brain.pglite`. Config `~/.gbrain/config.json`. Schema v144.
- **Index**: `C:\dev` tree indexed as source `toolforge` (~1,448 pages). Single federated source + `default`.
- **MCP**: registered with Claude Code at user scope — `claude mcp add --scope user gbrain -- "C:\Users\soren\.gemini\antigravity\bin\gbrain.exe" serve`. Needs a Claude Code restart per session to expose `mcp__gbrain__*`.
- **gstack config**: repo policy `github.com/sorensencc-dotcom/toolforge` → read-write; brain_trust_policy@local → personal; artifacts_sync_mode + transcript_ingest_mode → off.

**Known gaps (both by design in the Antigravity config, not broken):**
1. `embedding_disabled: true`, no provider key → `gbrain search` is keyword-only (BM25-ish), no semantic ranking. To enable: set an embedding provider key, flip the flag, run `gbrain embed --stale` (~5,366 chunks, cheap on text-embedding-3-small). Without this gbrain is ~a slow ripgrep; its only real niche vs [[reference-...]] graft is semantic recall over past plans/retros/decisions.
2. Schema pack `gbrain-base-v2` is not code-aware → `gbrain code-def / code-refs / code-callers` return nothing, and `gbrain dream` (call graph) can't build. Use `graft` for all symbol/call-graph work in this repo (graft is the repo's primary, code-aware tool).
3. `gbrain doctor` = `unhealthy` (health_score 0) — driven by `resolver_health` fail: 51 skills under `C:\dev\skills\` lack trigger rows in AGENTS.md "Brain operations". Only degrades gbrain's own skill-routing feature (unused here — repo uses gstack `/`-commands + IJFW). Cosmetic for search/MCP; leave unless gbrain skill-routing is wanted.

**Do NOT** append gstack `## GBrain Configuration` / `## GBrain Search Guidance` blocks to `C:\dev\CLAUDE.md` — that file is a deliberate 17-line thin `@AGENTS.md` adapter, AGENTS.md already has a `## GBrain Search` section, and the monorepo auto-commit daemon lands stray edits on whatever branch is checked out. The /setup-gbrain + /sync-gbrain skills try to write those blocks; revert them (`git checkout -- CLAUDE.md`).
