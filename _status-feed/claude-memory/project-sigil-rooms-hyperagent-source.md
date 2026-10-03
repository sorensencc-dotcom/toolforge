---
name: project-sigil-rooms-hyperagent-source
description: "Sigil \"Federated Rooms\" feature is modeled on Hyperagent Rooms; Gemini-drafted specs/UI invented most of the extra scope"
metadata:
  node_type: memory
  type: project
  originSessionId: 00b4b895-f46a-422e-a94d-6540b07cce59
  modified: 2026-10-02T18:35:38.214Z
---

Sigil Federated Rooms (proposed 2026-10-02, not yet designed or built) is modeled on Hyperagent Rooms: https://www.hyperagent.com/docs/concepts/rooms (Beta upstream). Sub-pages: working-in-a-room, automate-a-room, manage-a-room.

Upstream model: roles Owner / Room manager / Member; agents on the same roster with a response mode (joins conversations | @mentions only); a room-level router decides which agent replies; reply threads attached to the parent message; no private rooms in a team workspace; in-room approval cards ("approvals for actions that use a specific person's account can only be given by that person"); webhook + schedule triggers; Room notes + Canvas.

The Gemini-drafted pastes (sigil-federated-rooms-spec.md, sigil-integration-walkthrough.md, SigilRoomUI v1-v3, useSigilRoom.ts, sigil-rooms-client.ts) were reviewed 2026-10-02 and are NOT implementable. They invented A2A delegation frames, Rego/OPA, a $10k ceiling, confidence thresholds, a mobile IndexedDB outbox, and co-owner/editor roles, none of which appear in Hyperagent's docs.

Design draft: `C:\dev\sigil-repo\docs\superpowers\specs\2026-10-02-sigil-rooms-design.md` (uncommitted as of 2026-10-02). Decisions so far:
- The router runs on a local Ollama model, `qwen2.5:7b`.
- Hosted apps each get one path: Cowork = MCP plugin only; ChatGPT = plugin first, with an API agent only if a test shows write tools never fire; Muse = MCP only, experimental.
- Grok bots live in the Grok Bot app on the user's account, not on this machine; nothing spawns them. Start with Chief and Helix CI Triage only.
- Antigravity CLI starts read-only.

**Why:** future sessions should judge the scope against the Hyperagent source, not against the Gemini drafts.
**How to apply:** when designing Sigil rooms, map Hyperagent concepts onto the real `sigil/1` envelope and relay (`C:\dev\sigil-repo`). Do not copy Hyperagent's "agents run under the owner's account" credential model; use Sigil per-endpoint identity + capability grants instead.
