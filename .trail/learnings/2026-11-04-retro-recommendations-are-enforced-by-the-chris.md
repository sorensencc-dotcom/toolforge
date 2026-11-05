---
title: "Retro recommendations are enforced by the pre-commit hook and a shared BOM strip, not left as advice"
author: Chris
date: 2026-11-04
branch: fix/mcp-playwright-package
cost: { minutes: 14, tokens: 130807 }
id: l-ee92c361
scope: repo
status: active
src: agent
touches:
  - ".githooks/pre-commit"
  - scripts/trm-ingress-watcher.mjs
---

## Decided
Governance workflow edits now run the delivery-guard suite in the pre-commit hook. A missing trail learning is a non-blocking reminder. Payload readers strip a UTF-8 BOM before parsing.

## Tried and ruled out
- A 60s limit on the delivery-guard run: the suite takes about 33s alone but was killed at 60s when other tests ran at the same time. The hook allows 180s.
- Blocking commits that lack a trail learning: not every change has one worth keeping, so it only prints a note.

## Watch out
- The JSON content type for Drive staging is not enforced, because no staging code that sets a content type was found.
- The full routing test file times out at 60s (29 pass, 1 fail); not investigated, may predate this change.

In the code:
- C:\dev\.githooks\pre-commit
- C:\dev\scripts\trm-ingress-watcher.mjs (stripBom, parsePayload, resolveGoogleDocId)
- C:\dev\tests\trm-ingress-routing.test.mjs
- C:\dev\CIC-GOVERNANCE\packages\delivery-guard (npm test)
