---
title: "Warp CLI + WhichLLM Local-Model Routing — Exploration Note"
document_id: "WARP-WHICHLLM-EXPLORATION"
category: "exploration"
status: "exploratory — not approved, not scheduled"
version: "0.1.0"
date: "2026-09-21"
---

# Warp CLI + WhichLLM integration — exploration note

**Status: not decided. This is a scoping note, not a spec or roadmap item.**

## The idea

Warp CLI (docs.warp.dev) supports custom inference endpoints and custom
routers as its model-selection mechanism. Toolforge already has a working
WhichLLM routing/eval wrapper — the `cic-whichllm-integration-pack` — with
`OllamaProvider` (local) and `OpenRouterProvider` (cloud) legs already
implemented. The question: build a thin shim so Warp's agent mode routes
through WhichLLM, giving governed access to local models from inside Warp.

A second, related idea surfaced in discussion: could the same integration
also drive automatic code review and fixes?

## What already exists (don't rebuild)

- `cic-whichllm-integration-pack` — governance (GC-01..GC-05), SHA-256
  lineage hash chain, harvester registry, Prometheus observability. See
  `CIC-GOVERNANCE/packages/cic-whichllm-integration-pack/README.md`.
- `OllamaProvider` + `OpenRouterProvider` — both providers already coded.
- Automatic code review/fix tooling already in the repo/ecosystem:
  `code-review` skill, `ijfw:ijfw-code-fixer` agent, gstack `/review` and
  `/ship`, `skills/writing-heuristics/src/fixer.ts` as a mechanical-fix
  example.

## Constraints found in Warp's docs

- Custom inference endpoints: OpenAI-compatible `/v1/chat/completions`
  only, manual model-picker (no auto-routing), must be publicly reachable
  via tunnel — no localhost.
- Custom routers: static YAML, Warp-native models only, no external
  webhook.
- `WARP_API_KEY` env var preferred over CLI flag for headless auth (avoids
  shell-history / process-listing exposure).

## Proposed shape (if built)

Thin OpenAI-compatible server wrapping `WhichLLMAdapter` +
`OllamaProvider` + `OpenRouterProvider`. Governance/lineage/routing stays
server-side. Exposed via tunnel, registered as one fixed Warp custom
endpoint model.

Rough size: ~1 day. v1 non-goals: streaming, multi-model picker,
enterprise endpoints, retry tuning beyond what the pack already does.

## Open risks (unresolved)

- Warp's exact outbound request schema for tool-use/function-calling
  fields — not verified against a live Warp instance.
- Tunnel URL stability — free-tier Cloudflare Tunnel / ngrok both rotate
  URLs, same problem either way. No stable-hostname decision made.
- No SDD vs. hand-rolled build decision made.

## Auto code review/fix angle

Warp-driven auto-review/fix would duplicate `ijfw-code-fixer` +
`code-review` + gstack `/review`/`/ship` unless scoped narrowly (e.g.
cheap/local-model routine-lint passes, or scheduled/unattended runs).
Mandatory guardrail either way, per this repo's governance: no
auto-merge, human review before merge, no simulated/system-message
approval accepted as consent.

## Community research (2026-09-21, `/last30days`)

Ran `/last30days` against "Warp CLI custom model routing and AI agent
automatic code review" across Hacker News (29 stories) and Reddit (7
threads), 36 items total, no X/YouTube configured. Result: **nothing
solid** — every evidence cluster fell below the relevance floor. The
window's HN/Reddit chatter skewed toward general AI-agent topics (agent
memory, agent security gateways, "AI-written code is still your code"
takes) rather than anything specifically about Warp + custom/local model
routing or agentic auto-review-and-fix workflows. No community precedent
found either confirming or discouraging this approach — treat this as an
absence of signal, not validation.

## Bottom line

No decision made. If this gets picked up later, next steps in order:
verify Warp's live request schema, decide tunnel provider, decide
SDD vs. hand-rolled, and re-scope the auto-review angle to something
non-duplicative of existing tooling.
