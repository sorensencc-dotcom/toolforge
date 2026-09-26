# `/why` Skill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a global agent skill at `C:\Users\soren\.agents\skills\why\SKILL.md` that retrieves evidence from TRM vault and kb-context-cache before an agent reasons from any claim.

**Architecture:** A single SKILL.md protocol document. No runtime code, no scripts. The skill instructs the agent to grep `C:\Users\soren\trm-vault\trm\research-gaps\` (top 3 files by match count), fall back to `kb-context-cache` MCP, emit a structured `WHY-EVIDENCE` block with `corroborated` and `single-sourced` boolean flags, then emit a prose summary. Verdict is `GROUNDED` or `NO-EVIDENCE`.

**Tech Stack:** Markdown (SKILL.md), existing `kb-context-cache` MCP (already registered), TRM vault on disk at `C:\Users\soren\trm-vault\`.

## Global Constraints

- Skill lives at `C:\Users\soren\.agents\skills\why\SKILL.md` (global, not repo-scoped)
- No new dependencies, no scripts, no helper files — pure SKILL.md
- Evidence block format: YAML-like markdown block headed `## WHY-EVIDENCE`
- Two verdicts only: `GROUNDED` | `NO-EVIDENCE`
- Two source flags: `corroborated: true/false`, `single-sourced: true/false`
- Vault path: `C:\Users\soren\trm-vault\trm\research-gaps\` (Windows; forward slashes cross-platform)
- Top-3 files by grep match count — caveat noted inline
- Gate is behavioral (instruction), not structural (runtime enforcement)

---

### Task 1: Scaffold the skill directory and write the SKILL.md

**Files:**
- Create: `C:\Users\soren\.agents\skills\why\SKILL.md`

**Interfaces:**
- Consumes: nothing (first task)
- Produces: `SKILL.md` with complete protocol — all later tasks only verify and test it

- [ ] **Step 1: Verify the target directory doesn't already exist**

```powershell
Test-Path "C:\Users\soren\.agents\skills\why"
```

Expected: `False`. If `True`, inspect contents before proceeding — don't overwrite a pre-existing skill.

- [ ] **Step 2: Create the skill directory**

```powershell
New-Item -ItemType Directory -Path "C:\Users\soren\.agents\skills\why"
```

Expected: Directory created, no error.

- [ ] **Step 3: Write SKILL.md**

Create `C:\Users\soren\.agents\skills\why\SKILL.md` with this exact content:

````markdown
---
name: why
description: "Grounds any claim — architectural or domain-research — in verifiable evidence before the agent reasons from it. Enforces Evidence Before Confidence as a structural step. Use when asked /why, before diagnosing, before asserting a fact, or before modifying code based on an assumption."
---

# `/why` — Evidence Before Confidence

Ground a claim in evidence from the TRM vault and kb-context-cache before acting on it.

## When to Use

Invoke before:
- Asserting why an architectural decision was made
- Claiming a domain fact (person, place, event, organization)
- Diagnosing a bug whose root cause isn't directly observable
- Any statement that begins "because", "we do this because", or "the reason is"

## Retrieval Protocol

### Step 1: Extract noun phrases

Extract key noun phrases from the query. Skip stop words (the, is, a, of, in, to, for, etc.). If no noun phrases can be extracted, ask for a more specific query and stop.

### Step 2: Grep the vault

```
grep -ri "<phrase>" C:\Users\soren\trm-vault\trm\research-gaps\
```

**Windows path — use forward slashes on non-Windows.**

Run one grep per extracted phrase. Collect matching lines and their file paths. Rank files by match count (number of grep hits). Take the **top 3 files**.

> ponytail: top-3 cap is a pragmatic budget; upgrade path is a scored retrieval index if recall proves insufficient.
>
> Caveat: match count ≠ semantic relevance. A repetitive gap card can rank above a precise one. Use judgment if a top-ranked file looks irrelevant.

For each of the top 3 files, read **only the rows** (table rows in the gap card markdown) whose `Question` or `Answer excerpt` column contains the phrase. Do not read the whole file.

### Step 3: Query kb-context-cache MCP

Run `query_context_cache` with the same phrases. For any hits, run `fetch_topic_note` on the top result. This supplements vault results — it does not replace them.

### Step 4: Merge and flag

Merge all results. Deduplicate by source. For each source, assign flags:

- `corroborated: true` — the same claim appears in ≥2 distinct source files (a vault file and an MCP note each count as one)
- `corroborated: false` — only one source
- `single-sourced: true` — claim comes from exactly 1 file AND that file's entry key contains `:under-sourced:` — meaning TRM itself flagged it as unverified
- `single-sourced: false` — otherwise

Rank sources: corroboration count first, then recency (`First-seen date` from gap card).

Flag contradictions: if one source's excerpt directly contradicts another's, add to the `contradictions:` list.

### Step 5: Check staleness

For each vault source, read its `First-seen date`. If > 90 days from today, annotate the source `[stale: YYYY-MM-DD]`.

### Step 6: Determine verdict

- Any source returned → `GROUNDED`
- No sources from either vault or MCP → `NO-EVIDENCE`

## Output Format

Always emit the structured block first, then the prose summary.

### Structured Evidence Block

```
## WHY-EVIDENCE
query: "<original query>"
sources:
  - file: trm-vault/trm/research-gaps/<filename>.md
    excerpt: "…verbatim excerpt from the matching row…"
    corroborated: true
    single-sourced: false
  - mcp: kb-context-cache / query_context_cache
    excerpt: "…verbatim excerpt…"
    corroborated: false
    single-sourced: true   # low-confidence: excluded from prose summary
contradictions: []
verdict: GROUNDED | NO-EVIDENCE
```

Rules:
- `excerpt` must be verbatim from the source. Do not paraphrase.
- Sources with `single-sourced: true` are included in the block but **excluded from the prose summary**.
- `contradictions:` lists verbatim pairs, not interpretations.

### Prose Summary

Follows the block. 3–5 sentences. Each claim cites its source inline (e.g., `[cic-daily-research.md]`). Sources with `single-sourced: true` are omitted from the summary. If verdict is `NO-EVIDENCE`, replace the summary entirely with:

> **HOLD — No evidence found.** Cannot proceed. State what evidence is missing and what retrieval was attempted.

## Hard Gate

| Verdict | What to do |
|---|---|
| `GROUNDED` | Proceed. Cite sources in all output. If any source has `single-sourced: true`, the evidence block carries that signal for downstream agents; also name those sources as unverified in the prose summary and (for human readers) in commit messages or diagnostic notes. |
| `NO-EVIDENCE` | **Stop.** Emit the hold notice. Do not diagnose, assert, or modify code. |

> **This gate is a behavioral instruction, not structural enforcement.** A SKILL.md cannot intercept tool calls. Compliance depends on the agent following the skill.

## Failure Modes

| Condition | Behavior |
|---|---|
| `C:\Users\soren\trm-vault` not found | Skip vault step. Proceed to MCP. Warn once: "Vault not found at expected path." |
| MCP unavailable | Skip MCP step. If vault also returned nothing → `NO-EVIDENCE`. |
| Query too vague (no noun phrases extractable) | Ask for a more specific query. Do not guess. |
| Gap card stale (First-seen date > 90 days) | Include with `[stale: YYYY-MM-DD]` annotation. |

## Composition

`/why` is a pre-step convention, not a runtime dependency. Any skill may instruct the agent to invoke `/why` before acting on a claim. Embed the `WHY-EVIDENCE` block in context and cite it downstream.

No skill wiring or runtime registration required.

## Scope

- Reads: `C:\Users\soren\trm-vault\trm\research-gaps\` and `kb-context-cache` MCP only
- Does **not** search the web
- Does **not** summarize arbitrary files
- Does **not** write gap cards (that is `trm-gap-triage`'s job)
````

- [ ] **Step 4: Verify the file was created**

```powershell
Test-Path "C:\Users\soren\.agents\skills\why\SKILL.md"
```

Expected: `True`

- [ ] **Step 5: Smoke-check the frontmatter**

```powershell
Get-Content "C:\Users\soren\.agents\skills\why\SKILL.md" | Select-Object -First 5
```

Expected output contains `name: why` and `description:`.

- [ ] **Step 6: Commit**

```powershell
cd C:\Users\soren\.agents
git add skills/why/SKILL.md
git commit -m "feat: add /why evidence-grounding skill"
```

Expected: commit succeeds. If `.agents` is not a git repo, skip the commit and note the file path for manual tracking.

---

### Task 2: Smoke-test the skill with a live query

**Files:**
- No files created or modified — this task is a manual validation run.

**Interfaces:**
- Consumes: `C:\Users\soren\.agents\skills\why\SKILL.md` from Task 1
- Produces: confirmed working retrieval against the real vault and MCP

- [ ] **Step 1: Confirm the vault exists and has gap cards**

```powershell
Get-ChildItem "C:\Users\soren\trm-vault\trm\research-gaps\" -Filter "*.md" | Select-Object Name
```

Expected: several `.md` files listed (e.g., `cic-daily-research.md`, `cic-ford-executive-dynamics-politics.md`).

- [ ] **Step 2: Run a known-good vault query manually**

Simulate what the skill will do. Pick a noun phrase you know is in the vault (e.g., "Willow Run"):

```powershell
grep -ri "Willow Run" "C:\Users\soren\trm-vault\trm\research-gaps\" | Select-Object -First 10
```

Expected: several matching lines with file paths. If zero results, the path or phrase is wrong — do not proceed.

- [ ] **Step 3: Count hits per file and identify top 3**

```powershell
grep -ri "Willow Run" "C:\Users\soren\trm-vault\trm\research-gaps\" |
  ForEach-Object { ($_ -split ':')[0] } |
  Group-Object |
  Sort-Object Count -Descending |
  Select-Object -First 3
```

Expected: 3 file paths with hit counts. These are the files the skill would read.

- [ ] **Step 4: Verify kb-context-cache MCP is available**

In an agent session, run:
```
query_context_cache("Willow Run")
```

Expected: returns results or an explicit empty response — not a tool-not-found error. If tool-not-found, note that vault-only mode will be the fallback.

- [ ] **Step 5: Invoke the skill in an agent session**

Open a new agent session, type:
```
/why "what evidence supports Sorensen's role at Willow Run?"
```

Expected output contains:
1. A `## WHY-EVIDENCE` block with at least one `file:` source
2. `verdict: GROUNDED`
3. A prose summary of 3–5 sentences citing sources inline
4. No hallucinated content — excerpts must be verbatim from the gap cards

- [ ] **Step 6: Test the NO-EVIDENCE path**

In an agent session, type:
```
/why "what is the capital of France?"
```

Expected: `verdict: NO-EVIDENCE` and a hold notice. The agent must not answer from general knowledge.

- [ ] **Step 7: Test the single-sourced path**

In an agent session, type:
```
/why "what claims are under-corroborated in the Ford executive research?"
```

Expected: at least one source with `single-sourced: true`, that source excluded from the prose summary, and a note in the summary that some sources are unverified.

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task |
|---|---|
| Global skill at `C:\Users\soren\.agents\skills\why\` | Task 1 |
| Vault-direct retrieval from `trm/research-gaps/` | Task 1 (Step 3, Retrieval Protocol) |
| Top 3 by match count, caveat noted | Task 1 (Step 3), verified Task 2 Step 3 |
| kb-context-cache MCP fallback | Task 1 (Step 3), verified Task 2 Step 4 |
| `corroborated` + `single-sourced` booleans | Task 1 (Step 3) |
| Staleness annotation (> 90 days) | Task 1 (Step 3, Step 5) |
| Structured evidence block format | Task 1 (Step 3, Output Format) |
| Prose summary with inline citations | Task 1 (Step 3, Output Format) |
| `GROUNDED` / `NO-EVIDENCE` verdicts only | Task 1 (Step 3, Hard Gate) |
| Behavioral gate (not structural) | Task 1 (Step 3, Hard Gate note) |
| All failure modes handled | Task 1 (Step 3, Failure Modes) |
| Scope constraints (no web, no file summarizer) | Task 1 (Step 3, Scope) |
| NO-EVIDENCE path validated | Task 2 Step 6 |
| single-sourced path validated | Task 2 Step 7 |

No gaps found.

**Placeholder scan:** No TBDs, no TODOs, no "similar to Task N" references. All steps show exact commands or content.

**Type consistency:** Only one file produced (SKILL.md). No cross-task type contracts to check.
