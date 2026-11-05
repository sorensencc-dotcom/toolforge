---
title: "RFC: Frontier lab pre-deployment verification standards and resignation signals"
category: "research"
topic: "rfc-frontier-lab-verification-standards-dissent"
gap_id: "act-04-frontier-lab-verification-standards-dissent"
status: "draft"
created_at: "2026-09-27T13:59:00.000Z"
revised_at: "2026-10-24T00:00:00.000Z"
author: "sorensencc-dotcom"
source: "mobile-gemini-gdoc"
source_doc: "https://docs.google.com/document/d/1qIlAwomiZf3cd2WkfWgadm7gUzPgl5c2wToBFyFAn-s/edit"
card_priority: "HIGH"
card_category: "MONITOR"
tracking_issue: "https://github.com/sorensencc-dotcom/toolforge/issues/63"
citations:
  - "src/providers/model-selection.js"
  - "_integration/model_selection.json"
---

# RFC: Frontier lab pre-deployment verification standards and resignation signals

> **Revision note (2026-10-24).** The first draft of this RFC (2026-09-27) came from the ingress filename only. The triage pipeline never read the source card, so that draft covered LLM-as-a-judge versus deterministic evaluation, which the card does not mention. This revision follows the card text in the [ACT-04 source card](https://docs.google.com/document/d/1qIlAwomiZf3cd2WkfWgadm7gUzPgl5c2wToBFyFAn-s/edit). The card set priority HIGH. The ingress ledger recorded P2.

## 1. Source card summary

The card is a MONITOR item that a Gemini daily AI news summary produced. It asks for three things:

1. Monitor public resignations, whistleblowing, and verification debates at Google DeepMind, OpenAI, Anthropic, and Meta.
2. Track the formation of an independent frontier AI standards body.
3. Assess whether compressed pre-deployment verification increases the risk of model drift, regressions, or security issues in APIs this stack depends on.

## 2. Fact check of the card's claims

The card came from an automated news summary. Check each claim against primary coverage before you act on it.

| Card claim | Status | Source |
|---|---|---|
| Robert O'Callahan, a Google DeepMind chip-team engineer, resigned publicly | Confirmed, resigned around 2026-09-24 | [Business Insider coverage of the O'Callahan resignation](https://www.businessinsider.com/google-deepmind-employee-resigns-ai-safety-harm-chips-robert-ocallahan-2026-9), [explainx.ai O'Callahan timeline](https://explainx.ai/blog/robert-ocallahan-google-deepmind-resign-ai-pace-2026) |
| He cited leadership compressing hardware verification cycles and bypassing safety checkpoints | Not confirmed. Coverage reports a broader reason: AI risk that is "real but uncertain" and progress outpacing human adaptation | Same as above |
| Named releases "Gemini 4" and "Project Suncatcher" are being rushed | Not confirmed | None found |
| An independent body named "SAF-AI" is forming | Partly confirmed. The reported name is Standards Authority for Frontier AI (**SAFA**), an industry-led body from Google, OpenAI, and Anthropic for third-party pre-deployment testing and incident reporting | [CIO report on the SAFA standards body](https://www.cio.com/article/4226392/the-companies-racing-to-build-frontier-ai-are-now-racing-to-govern-it.html), [Law.com analysis of SAFA](https://www.law.com/legaltechnews/2026/09/28/as-ai-labs-build-a-safety-standards-body-existing-legal-frameworks-and-prior-groups-mistakes-should-be-instructive/) |

Treat the "verification compression" framing as the summarizer's interpretation, not as a reported fact.

## 3. Current stack exposure

A repo scan on 2026-10-24 measured the following:

1. **Floating aliases.** Source files contain no `-latest` model aliases. Pinned IDs are already the norm.
2. **Stale pins.** Pinned IDs include legacy models, for example `gpt-4o` (35 references) and `claude-3.5-sonnet` (26 references). Pinning protects you from silent upgrades, but stale pins carry deprecation risk.
3. **Runtime pin enforcement.** `validateProviderEcho` in `src/providers/model-selection.js` throws `PROVIDER_ECHO_MISMATCH` when the responding provider or model differs from the request. It sets `retry: false` and `fallback: false`.
4. **Routing.** `loadModelSelection` rejects any record in `_integration/model_selection.json` that is not `local-only` Ollama routing with `cloud_routing_enabled: false`.
5. **Failover.** No multi-provider failover path exists. The echo check fails closed by design.

## 4. Deliverables and proposed disposition

| Card deliverable | Disposition |
|---|---|
| Tracking ledger of lab departures and reported safety shortcuts | Research-only. Keep it in the TRM research archive, not in toolforge. Record each entry with a primary source link and a confirmed or unconfirmed status, as in section 2. |
| Model version pinning policy across local harnesses | Mostly met. Pins exist and the echo check enforces them at runtime. Open gap: no policy for retiring stale pins. Proposal: a scheduled check that lists pinned IDs against each provider's deprecation list. |
| Multi-provider failover readiness matrix | Conflicts with the current fail-closed, local-only design. Automatic failover would weaken the echo-mismatch guarantee. Proposal: document a manual failover runbook per critical workflow instead of automatic failover. This needs a Tier 1 decision. |

## 5. Open questions

- [ ] Tier 1: accept manual failover runbooks in place of the card's automatic failover?
- [ ] Should the stale-pin check run in CI or in the retro audit?
- [ ] Where does the departures ledger live: TRM research archive or kb-sync wiki?
