---
title: "Repo Triage and Digest"
category: "kb-skills"
status: "active"
---

# Repo triage and digest

`repo-triage-and-digest` is the KB-Skills intake skill. Stage 1 returns GitDiagram links. Stage 2 returns a size-capped Gitingest digest. Register the page from `wiki/sync-tools/repo-triage-and-digest.md`. `npm run wiki:publish` copies it to the wiki root and keeps the Skill Library link.

Canonical source: [skills/repo-triage-and-digest on main](https://github.com/sorensencc-dotcom/toolforge/tree/main/skills/repo-triage-and-digest).

The branch `feat/repo-triage-and-digest` was deleted after pull request 128 merged. That tree URL returns 404. Use `main`.

## kb-sync TRM contract

Call `triage_and_digest` for `https://github.com/sorensencc-dotcom/kb-sync` with `targetModules` `modules/trm/*` and `core/*`, `excludePatterns` `tests/*,docs/*,*.lock,*.png,*.html`, and `maxFileSizeKb` 50.

Remote mode returns `content: null` and these URLs:

- `https://gitdiagram.com/sorensencc-dotcom/kb-sync`
- `https://gitdiagram.com/sorensencc-dotcom/kb-sync/videos`
- `https://gitingest.com/sorensencc-dotcom/kb-sync?include=modules%2Ftrm%2F*%2Ccore%2F*&exclude=tests%2F*%2Cdocs%2F*%2C*.lock%2C*.png%2C*.html&max_size=50`

A local checkout keeps `modules/trm/query-expander.mjs`, `modules/trm/ast-grounding.mjs`, `modules/trm/gap-triage-engine.mjs`, and `core/*` files at or under 50 kB. The walk skips `node_modules`, `.git`, `dist`, `vendor`, and `coverage`. An auth token is not written and is not returned.

## Dispatcher boundary

`python tools/agent-dispatch/run.py <contract>` runs a route contract with `recommended_route`, `allowed_routes`, and `max_cost_usd`. It does not call `triage_and_digest`. There is no `tools/agent-dispatch` entry named in the notebook placeholder. Pass `--identity` and `--registry` together when you want a live Sigil check. A placeholder `ed25519:` string is not a signature.
