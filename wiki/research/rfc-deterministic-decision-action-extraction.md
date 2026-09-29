---
title: "RFC: Deterministic Decision & Action Extraction"
category: "research"
topic: "rfc-deterministic-decision-action-extraction"
gap_id: "act-02-deterministic-decision-action-extraction"
status: "accepted"
created_at: "2026-09-28T14:26:00.000Z"
updated_at: "2026-09-29T00:00:00.000Z"
assigned_tier: "Tier 2 (Execution)"
author: "sorensencc-dotcom"
source: "mobile-gemini-gdoc"
tracking_issue: "https://github.com/sorensencc-dotcom/toolforge/issues/61"
citations:
  - "scripts/decision-action-extract.mjs"
  - "scripts/decision-action-extract.test.mjs"
  - "dev/triage/decision-staging/README.md"
---

# Deterministic decision and action extraction

## Problem

Meeting and research transcripts lose owners and deadlines when the notes stay free-form. A card can enter the TRM backlog only when it names one accountable owner, a firm deadline, and an observable completion check.

## Decision

`scripts/decision-action-extract.mjs` parses labeled transcript blocks, pipe rows, and strict JSON. It validates four fields, writes accepted cards to `dev/triage/decision-staging/`, and writes failures to `dev/triage/decision-quarantine/`.

| Field | Rule |
|---|---|
| `decision_summary` | Concrete decision, 12–400 characters |
| `owner` | One person, agent slug, or email. Shared owners are rejected |
| `deadline` | ISO-8601 date or `Sprint N`. "soon" is rejected |
| `verification_gate` | Observable completion check, such as a test, file, or `git diff` result |

Copy a staged card into `dev/triage/decision-backlog/` with `--approve <id>`. Approval revalidates the JSON block and checks that the card id still matches the four fields. The script does not run `git commit`.

Unlabeled prose produces no owner and no card. That keeps the extractor from filling gaps the transcript did not state.

## Operator steps

1. Run `node scripts/decision-action-extract.mjs --input <transcript.txt>`.
2. Read the staged `dec-*.md` card and the quarantine report.
3. Run `node scripts/decision-action-extract.mjs --approve dec-<id>` for each card you accept.
4. Review `git diff`, then commit the backlog card yourself.

## Verification

Run `node --test --test-timeout=10000 scripts/decision-action-extract.test.mjs`.

A passing run accepts a labeled block, a Meet timestamp line, a pipe row, and a JSON proposal. It rejects "soon", "ASAP", "2026-02-31", "Alex and Jordan", "the team", and unlabeled chatter. The default extract leaves the backlog empty. `--approve` moves one card and refuses a card whose JSON no longer matches its id.
