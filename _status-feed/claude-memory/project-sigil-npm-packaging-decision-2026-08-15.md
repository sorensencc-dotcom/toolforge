---
name: project-sigil-npm-packaging-decision-2026-08-15
description: "Decision on sigil npm packaging (bin/sigil.mjs) vs relay CLI (sigil/cli/sigil.mjs) — keep both, add env-aware auto-switching"
metadata: 
  node_type: memory
  type: project
  originSessionId: f2b61664-db06-4322-a0b2-7f2788dcbb07
  modified: 2026-08-16T00:24:15.631Z
---

Decision (2026-08-15): npm packaging (`bin/sigil.mjs`, MCP stdio connector) stays — valid for local/contained dev. It does NOT replace `sigil/cli/sigil.mjs` (the relay CLI: `relay up`/`send`/`inbox`) — confirmed separate subsystems, different ports (8787 connector vs 8791/8793 relay).

**Why:** local dev wants the simple in-memory relay; other environments (multi-user, remote, hosted) will need a different transport/backing store. User wants this decided by capability, not manually flagged each time.

**How to apply:** Next real feature is environment-aware auto-switching — Sigil should detect the deployment context (local-only vs exposed/multi-user/remote) and pick the right transport/connector strategy itself, not require the user to choose. Not started. Scope this as its own feature (needs brainstorming pass on detection signals — env vars? presence of remote config? explicit flag with local as default fallback?) before implementation. See [[feedback_codex_scope_creep_autopush_sigil]] — keep Codex scoped tight when this gets dispatched.
