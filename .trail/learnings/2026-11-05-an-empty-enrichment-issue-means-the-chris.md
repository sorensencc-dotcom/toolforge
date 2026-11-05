---
title: "An empty enrichment issue means the card body never reached the enricher, not that the card is research"
author: Chris
date: 2026-11-05
branch: fix/mcp-playwright-package
cost: { minutes: 1, tokens: 1147 }
id: l-9f7aeed4
scope: repo
status: active
src: agent
touches:
  - scripts/trm-post-promote-enricher.mjs
  - scripts/trm-promote-card.mjs
---

## Decided
Enricher now renders object-valued test scaffold, CLI contract and plan steps as text, and skips research cards.

## Tried and ruled out
Calling kb-sync issue 146 a misrouted research card. Its receipt shows category TRIAGE, domain REWRITE-MCP, target core, so it never matched the research rules. The real cause was the Drive document body failing to extract, leaving only the filename, so the enricher worked from nothing.

## Watch out
Check the completion or rejection receipt in the TRM mobile-outbox before closing a card-generated issue as misrouted.
Research cards are already blocked from issue creation by the NON_CODE_TARGETS set in the promoter, so no change was needed there.

In the code:
scripts/trm-post-promote-enricher.mjs: toText, isResearchCard
scripts/trm-promote-card.mjs: NON_CODE_TARGETS, resolveTargetRepo
G:\My Drive\TRM-Research\04_archive\mobile-outbox\receipt-act-03-evaluate-patch-gap-dependency-scanner-rejected.md
