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



---

## Architecture

### Retrieval Pipeline (ordered)

1. **Vault-direct (primary):** Grep `C:\Users\soren\trm-vault\trm\research-gaps\` (**Windows path; use forward slashes cross-platform**) for entity/topic noun phrases extracted from the query. Take the **top 3 files by match count** (hit density — caveat: count ≠ semantic relevance; repetitive gap cards can rank above precise ones). For each, read only rows whose `Question` or `Answer excerpt` contains the phrase.
2. **kb-context-cache MCP (fallback/supplement):** Run `query_context_cache` + `fetch_topic_note` with the same phrases for anything the vault grep misses or needs deeper context on.
3. **No evidence:** If both sources return nothing → emit `NO-EVIDENCE` verdict and halt. No inference.

### Source Flags

Gap cards carry no float scores. Each source in the evidence block gets two boolean flags derived from the retrieval results:

- `corroborated: true` — claim appears in ≥2 distinct source files (vault file or MCP note each count as one)
- `single-sourced: true` — claim appears in exactly 1 file whose entry key type is `under-sourced`

Sources with `single-sourced: true` are included in the structured block but excluded from the prose summary and annotated `[low-confidence]`.

### Staleness Annotation

Gap cards with `First-seen date` > 90 days old are included but annotated `[stale: YYYY-MM-DD]`.



---

## Output Format

### 1. Structured Evidence Block (agent-consumable)

```
## WHY-EVIDENCE
query: "<original query>"
sources:
  - file: trm-vault/trm/research-gaps/cic-daily-research.md
    excerpt: "…relevant excerpt…"
    corroborated: true
    single-sourced: false
  - mcp: kb-context-cache / query_context_cache
    excerpt: "…relevant excerpt…"
    corroborated: false
    single-sourced: true   # low-confidence: excluded from prose summary
contradictions: []
verdict: GROUNDED | NO-EVIDENCE
```

### 2. Prose Summary (human-readable)

Follows the structured block. 3–5 sentences. Each claim cites its source inline (e.g., `[cic-daily-research.md]`). Sources with `single-sourced: true` are named as unverified in the summary. If verdict is `NO-EVIDENCE`, the summary is replaced with a hold notice — no further reasoning is offered.


---

## Retrieval Protocol (Concrete Steps)

1. Extract key noun phrases from the query (skip stop words)
2. `grep -ri "<phrase>" C:\Users\soren\trm-vault\trm\research-gaps\` — collect matching lines + file paths
3. Take **top 3 files by match count**; for each, `view_file` only the matching row(s) — not the whole file
   <!-- ponytail: top-3 cap is a pragmatic budget; upgrade path is a scored retrieval index if recall proves insufficient -->
4. Run `query_context_cache` with the same phrases via `kb-context-cache` MCP
5. Merge results, deduplicate by source, rank by: corroboration count → recency
6. If merged result set is empty → `NO-EVIDENCE` verdict, halt


---

## Hard Gate: Evidence Before Confidence

| Verdict | Agent behavior |
|---|---|
| `GROUNDED` | Proceed. Cite sources. If any source has `single-sourced: true`, the evidence block already carries that signal for downstream agents; also note it in the prose summary and (for human readers) in the commit message or diagnostic note. |
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
- Reads only: `trm-vault/trm/research-gaps/`, and `kb-context-cache` MCP
