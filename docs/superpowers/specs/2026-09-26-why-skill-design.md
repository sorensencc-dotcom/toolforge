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

**Inference heuristic:** If the query contains "why do we", "how does", "what's the reason", "why is", or references a file/system/design choice → `architectural`. If the query references named people, places, organizations, dates, or contains "what evidence", "who", "when", "what supports" → `domain-research`. Default: `domain-research`. The label is cosmetic — it only affects the output block's `type` field.

---

## Architecture

### Retrieval Pipeline (ordered)

1. **Vault-direct (primary):** Grep `C:\Users\soren\trm-vault\trm\research-gaps\` markdown files for entity/topic noun phrases extracted from the query. Take the **top 3 files by match count** (grep hit density). For each, read only the rows whose `Question` or `Answer excerpt` column contains the phrase — not the full file.
2. **kb-context-cache MCP (fallback/supplement):** Run `query_context_cache` + `fetch_topic_note` with the same phrases for anything the vault grep misses or needs deeper context on.
3. **No evidence:** If both sources return nothing → emit `NO-EVIDENCE` verdict and halt. No inference.

### Confidence Derivation

Gap cards carry no float scores. Derive confidence categorically from what the vault actually contains:

| Signal | Confidence |
|---|---|
| Claim appears in ≥2 distinct gap card files | HIGH |
| Claim appears in exactly 1 file, question type is NOT `under-sourced` | MEDIUM |
| Claim appears in exactly 1 file, question type is `under-sourced` | LOW |
| Claim appears in `open-contradictions` entry | Contradiction flagged, confidence downgraded to LOW |

Map to the evidence block as: HIGH → 0.85, MEDIUM → 0.65, LOW → 0.45. The `corroborated` field is `true` when HIGH, `false` otherwise.

### Corroboration Definition

`corroborated: true` means the claim appears in **≥2 distinct source files** in the retrieval results (vault file or MCP note counts as one each).

### Confidence Floor

Sources with derived confidence LOW (0.45) are included in the structured block but excluded from the prose summary and annotated `[low-confidence]`.

### Staleness Annotation

Gap cards with `First-seen date` > 90 days old are included but annotated `[stale: YYYY-MM-DD]`.


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
2. `grep -ri "<phrase>" C:\Users\soren\trm-vault\trm\research-gaps\` — collect matching lines + file paths
3. Take **top 3 files by match count**; for each, `view_file` only the matching row(s) — not the whole file
   <!-- ponytail: top-3 cap is a pragmatic budget; upgrade path is a scored retrieval index if recall proves insufficient -->
4. Run `query_context_cache` with the same phrases via `kb-context-cache` MCP
5. Merge results, deduplicate by source, derive confidence per the Confidence Derivation table, rank by: corroboration count → recency → derived confidence
6. If merged result set is empty → `NO-EVIDENCE` verdict, halt


---

## Hard Gate: Evidence Before Confidence

| Verdict | Agent behavior |
|---|---|
| `GROUNDED` | Proceed. Cite sources in all output. |
| `SINGLE-SOURCED` | Proceed with explicit caveat. Flag in commit message or diagnostic note. |
| `NO-EVIDENCE` | **Hard stop.** State what evidence is missing. Do not diagnose, assert, or modify code. |

> [!NOTE]
> This gate is a **behavioral instruction**, not structural enforcement. A SKILL.md cannot intercept tool calls. The agent is instructed to halt on `NO-EVIDENCE` — but compliance depends on the agent following the skill. Do not treat this as a runtime block.


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
