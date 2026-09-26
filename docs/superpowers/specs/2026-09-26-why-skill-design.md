# `/why` Skill Design

**Date:** 2026-09-26  
**Status:** Approved  
**Location:** `C:\Users\soren\.agents\skills\why\SKILL.md` (global)

---

## Purpose

A global agent skill that grounds any claim — architectural or domain-research — in verifiable evidence before an agent reasons from it. Enforces "Evidence Before Confidence" as a structural step, not a behavioral convention.

---

## Invocation

```
/why "<claim or question>"
```

Examples:
```
/why "why do we cap TRM chunks at 380 KiB?"
/why "what evidence supports Sorensen's role at Willow Run?"
```

Query type (`architectural` | `domain-research`) is inferred from content — no flags.

---

## Architecture

### Retrieval Pipeline (ordered)

1. **Vault-direct (primary):** Grep `C:\Users\soren\trm-vault\registry\` markdown files for entity/topic noun phrases extracted from the query. For top hits, read the relevant section (not the full file) from `trm/research-gaps/` gap cards.
2. **kb-context-cache MCP (fallback/supplement):** Run `query_context_cache` + `fetch_topic_note` with the same phrases for anything the vault grep misses or needs deeper context on.
3. **No evidence:** If both sources return nothing above the confidence floor → emit `NO-EVIDENCE` verdict and halt. No inference.

### Confidence Floor

Sources with confidence < 0.60 are included in the structured block but excluded from the prose summary and annotated `[low-confidence]`.

### Staleness Annotation

Gap cards with `document_date` > 90 days old are included but annotated `[stale: YYYY-MM-DD]`.

---

## Output Format

### 1. Structured Evidence Block (agent-consumable)

```
## WHY-EVIDENCE
query: "<original query>"
type: architectural | domain-research
sources:
  - file: trm-vault/registry/<filename>.md
    excerpt: "…relevant excerpt…"
    confidence: 0.85
    corroborated: true
  - mcp: kb-context-cache / query_context_cache
    excerpt: "…relevant excerpt…"
    confidence: 0.72
    corroborated: false
contradictions: []
verdict: GROUNDED | SINGLE-SOURCED | NO-EVIDENCE
```

### 2. Prose Summary (human-readable)

Follows the structured block. 3–5 sentences. Each claim cites its source inline (e.g., `[cic-daily-research.md]`). If verdict is `SINGLE-SOURCED`, the summary states this explicitly. If verdict is `NO-EVIDENCE`, the summary is replaced with a hold notice — no further reasoning is offered.

---

## Retrieval Protocol (Concrete Steps)

1. Extract key noun phrases from the query (skip stop words)
2. `grep -ri "<phrase>" C:\Users\soren\trm-vault\registry\` — collect matching lines + file paths
3. For top hits, `view_file` the relevant section only
4. Run `query_context_cache` with the same phrases via `kb-context-cache` MCP
5. Merge results, deduplicate by source, rank by: corroboration count → recency → confidence score
6. If merged result set is empty → `NO-EVIDENCE` verdict, halt

---

## Hard Gate: Evidence Before Confidence

| Verdict | Agent behavior |
|---|---|
| `GROUNDED` | Proceed. Cite sources in all output. |
| `SINGLE-SOURCED` | Proceed with explicit caveat. Flag in commit message or diagnostic note. |
| `NO-EVIDENCE` | **Hard stop.** State what evidence is missing. Do not diagnose, assert, or modify code. |

The skill blocks any further agent action — code edits, diagnosis steps, assertions — until the evidence block is emitted.

---

## Failure Modes

| Condition | Behavior |
|---|---|
| `C:\Users\soren\trm-vault` not found | Skip vault step; proceed to MCP; warn once |
| MCP unavailable | Skip MCP step; if vault also empty → `NO-EVIDENCE` |
| Query too vague (no extractable noun phrases) | Ask for a more specific query before running |
| Gap card stale (> 90 days) | Include with `[stale: YYYY-MM-DD]` annotation |

---

## Composition with Other Skills

`/why` is a pre-step convention, not a runtime dependency. Any skill (`diagnosing-bugs`, `code-review`, `verify-ironledger`, etc.) may instruct the agent to invoke `/why` before acting on a claim. The `WHY-EVIDENCE` block is embedded in context and cited downstream.

No skill wiring, no runtime registration required.

---

## Scope Constraints

- **Not** a web search wrapper
- **Not** a general file summarizer
- **Not** a replacement for `trm-gap-triage` (that writes gap cards; this reads them)
- Reads only: `trm-vault/registry/`, `trm-vault/trm/research-gaps/`, and `kb-context-cache` MCP
