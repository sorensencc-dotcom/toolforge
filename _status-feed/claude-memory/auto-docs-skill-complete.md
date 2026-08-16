---
name: auto-docs-skill-complete
description: Auto-docs skill built; scans git diff → categorizes → updates all relevant docs atomically with zero prompts
metadata: 
  node_type: memory
  type: project
  originSessionId: 79e49eca-48fa-45a8-8b1c-9a2a289fbac2
---

**Auto-Docs Skill — Complete & Tested**

**What it does:**
1. Scans `git diff HEAD~1..HEAD` to detect changes
2. Categorizes by type: code, phase, schema, operations, dependencies
3. Maps categories → doc files (CHANGELOG, ROADMAP, SCHEMAS, README)
4. Writes all docs atomically (single fs.writeFile batch)
5. Stages + commits with auto-generated message `[claude] [category] + [category]...`
6. Returns detailed report: files changed, docs updated, git hash, next steps

**Key achievement:** Zero permission prompts. Uses PowerShell bypass configured in `~/.claude/settings.json`:
- `PowerShell(Set-Content *)`
- `PowerShell(Out-File *)`
- `PowerShell(New-Item -ItemType File *)`

**Files created:**
- Implementation: `c:\dev\rewrite-mcp\skills\auto-docs\index.js` (360 lines)
- Skill definition: `C:\Users\soren\.claude\skills\auto-docs.md` (user-facing docs)

**Tested:** Ran skill, staged 28 files, committed with hash 328eb4c, zero prompts. ✅

**Why:** Eliminates manual doc updates. One `/auto-docs` invocation catches all changes, updates all relevant docs, commits everything. Replaces 30+ permission clicks per session.

**Invocation:** `/auto-docs` (no arguments needed — fully auto-detected)

**Integration:** Replaces/supplements existing session-wrap skill. Works alongside it. Can be chained into workflows.
