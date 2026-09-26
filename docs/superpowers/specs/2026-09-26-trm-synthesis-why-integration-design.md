# TRM Closed-Loop Synthesis `/why` Evidence Integration Design

**Date:** 2026-09-26  
**Status:** Approved  
**Target Files:**
- `modules/wiki/why-verifier.mjs` (New verification engine)
- `modules/wiki/why-verifier.test.mjs` (Unit test suite)
- `scripts/run-closed-loop-research-v2.mjs` (Pipeline Step 4 integration)

---

## 1. Overview & Purpose

This design integrates the `/why` evidence-grounding protocol into the automated Topic Research Mining (TRM) closed-loop research pipeline. 

During Step 4 of `run-closed-loop-research-v2.mjs` (Layer 2 Wiki Synthesis), every synthesized research note (`wiki/research/${slug}.md`) is automatically cross-referenced against the local TRM research vault (`C:\Users\soren\trm-vault\trm\research-gaps\`). 

### Core Goals:
1. **Mathematical Grounding:** Prevent generative LLM hallucination in wiki synthesis by deriving verification status directly from mined primary source tables.
2. **Contradiction Preservation:** Prohibit synthesis models from creating false consensus across `:open-contradictions:` gap entries; inject prominent contradiction warning banners.
3. **Automated Provenance:** Embed a collapsible `## WHY-EVIDENCE` markdown block and YAML frontmatter tags (`verification_status`, `why_corroborated`) into every synthesized page.

---

## 2. Architecture & Data Flow

```
┌────────────────────────────────────────────────────────┐
│             TRM Closed-Loop Orchestrator               │
│            (run-closed-loop-research-v2.mjs)           │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│     Step 4: Layer 2 Wiki Synthesis Engine              │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│         modules/wiki/why-verifier.mjs                  │
│  - matchVaultGapCards(topicSlug, nounPhrases)          │
│  - evaluateCorroboration(sources, entryKeys)           │
│  - generateWhyEvidenceBlock(evidenceResult)            │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│       Synthesized Markdown with WHY-EVIDENCE           │
│  - Frontmatter: verification_status, why_corroborated  │
│  - Body: Preserved contradiction banners               │
│  - Footer: Collapsible ## WHY-EVIDENCE Block           │
└────────────────────────────────────────────────────────┘
```

---

## 3. Verification Module Specification (`modules/wiki/why-verifier.mjs`)

### Exported Functions

```javascript
/**
 * Verifies a topic against TRM research gap cards in the vault.
 *
 * @param {string} topicSlug - The topic name, category slug (e.g. 'open-contradictions', 'under-sourced'), or notebook slug (e.g. 'cic-willow-run-aviation-engineering')
 * @param {Object} [options]
 * @param {string} [options.vaultPath] - Path to trm-vault root (defaults to env or standard path)
 * @param {string} [options.gapsFilePath] - Optional explicit path to a single gap card or staging file
 * @param {string} [options.gapsContent] - Optional in-memory markdown content to evaluate directly
 * @returns {WhyVerificationResult}
 */
export function verifyTopicGaps(topicSlug, options = {}) { ... }

/**
 * Formats a WHY-EVIDENCE markdown block from verification results.
 *
 * @param {WhyVerificationResult} result
 * @returns {string} Collapsible details markdown block
 */
export function formatWhyEvidenceBlock(result) { ... }
```

### Result Schema

```typescript
interface WhyVerificationResult {
  topic: string;
  verdict: 'GROUNDED' | 'NO-EVIDENCE';
  verificationStatus: 'verified' | 'single-sourced' | 'contradiction_flagged' | 'unverified';
  corroborated: boolean;
  sources: Array<{
    file: string;
    excerpt: string;
    corroborated: boolean;
    singleSourced: boolean;
    isContradiction: boolean;
    entryKey: string;
    firstSeenDate?: string;
  }>;
  contradictions: string[];
  evidenceBlockMarkdown: string;
}
```

### Matching & Decision Rules

1. **Two-Mode Matching:**
   - **Category Mode:** If `topicSlug` is a standard gap category (`open-contradictions`, `under-sourced`, `adjacent-topics`, `follow-up`), extract all rows across gap cards where the entry key contains `:${topicSlug}:`.
   - **Topic/Notebook Mode:** If `topicSlug` is a notebook or subject slug (e.g. `cic-willow-run-aviation-engineering` or `willow-run`), match gap card files whose filename contains the slug, or whose table rows contain the noun phrases.
2. **Grounded vs No-Evidence:** If ≥1 matching gap card entry is found across `trm-vault/trm/research-gaps/*.md` (or in provided `gapsContent`), `verdict = 'GROUNDED'`. Otherwise, `verdict = 'NO-EVIDENCE'`.
3. **Corroboration:** `corroborated = true` if matching claims or citations appear across ≥2 distinct gap card files.
4. **Status Assignment:**
   - If any matched entry contains `:open-contradictions:`, `verificationStatus = 'contradiction_flagged'`.
   - Else if all matched entries contain `:under-sourced:` (or match count == 1 and under-sourced), `verificationStatus = 'single-sourced'`.
   - Else if `corroborated === true` (or valid single well-sourced entry), `verificationStatus = 'verified'`.
   - If `verdict === 'NO-EVIDENCE'`, `verificationStatus = 'unverified'`.
5. **Path Normalization:** All file paths written to YAML frontmatter or markdown blocks must be normalized to POSIX forward slashes (`/`) to avoid Windows escape character collisions (`\t`, `\r`, `\n`).


---

## 4. Synthesized Markdown Layout

```markdown
---
source_title: "Topic Title — TRM Synthesis"
repository: "CIC Research Vault — Live Synthesis"
document_date: "YYYY-MM-DD"
verification_status: "verified"          # verified | single-sourced | contradiction_flagged | unverified
why_corroborated: true                  # true | false
category: "daily"
topic: "topic-slug"
vault_source: "C:/Users/soren/trm-vault/trm/research-gaps/topic.md"
last_updated: "2026-09-26T00:00:00.000Z"
---

# Topic Title

> [!WARNING] Competing Historical Accounts (Preserved Contradiction)
> Primary archival sources contain competing assertions regarding [disputed topic]. Details below.

## Summary & Synthesis
... synthesized narrative ...

---

<details>
<summary><b>WHY-EVIDENCE Provenance Block</b></summary>

## WHY-EVIDENCE
query: "topic-slug"
sources:
  - file: trm-vault/trm/research-gaps/topic.md
    excerpt: "…verbatim excerpt from gap table…"
    corroborated: true
    single-sourced: false
    entry_key: "6fd7c40b-df90-444b-9c7a-a64682925856:open-contradictions:e5144ad8dcdb4e76211ded103daaf055a1c6408d544ca64c8bafa6150df921eb"
contradictions:
  - "Description of contradiction"
verdict: GROUNDED

</details>
```

---

## 5. Integration into `run-closed-loop-research-v2.mjs` (Step 4)

In `run-closed-loop-research-v2.mjs`, Step 4 will be updated to:
1. Import `verifyTopicGaps` and `formatWhyEvidenceBlock` from `../modules/wiki/why-verifier.mjs`.
2. For each generated topic slug:
   ```javascript
   const whyResult = verifyTopicGaps(slug, { vaultPath: TRM_VAULT });
   const banner = whyResult.contradictions.length > 0
     ? `> [!WARNING] Competing Historical Accounts (Preserved Contradiction)\n> Archival sources dispute: ${whyResult.contradictions.join('; ')}\n\n`
     : '';
   ```
3. Assemble frontmatter with `verification_status: whyResult.verificationStatus` and `why_corroborated: whyResult.corroborated`.
4. Append `whyResult.evidenceBlockMarkdown` inside the `<details>` wrapper at the end of the markdown note.

---

## 6. Failure Modes & Edge Case Matrix

| Condition | Behavior |
|---|---|
| **TRM Vault Missing** | `verifyTopicGaps` catches error gracefully, returns `verdict: 'NO-EVIDENCE'`, `verificationStatus: 'unverified'`. Pipeline continues. |
| **Topic Has No Matches** | Returns `verdict: 'NO-EVIDENCE'`, sets `verification_status: "unverified"`, appends hold notice. |
| **All Entries Single-Sourced** | Sets `verification_status: "single-sourced"`, `why_corroborated: false`, flags unverified in evidence block. |
| **Contradictory Claims Found** | Sets `verification_status: "contradiction_flagged"`, prepends warning banner. |

---

## 7. Verification & Self-Test Plan

1. **Unit Test Suite (`modules/wiki/why-verifier.test.mjs`):**
   - Tests extraction and hit matching for known gap topics (e.g. `cic-willow-run-aviation-engineering`).
   - Tests `contradiction_flagged` status derivation from `:open-contradictions:`.
   - Tests `single-sourced` status derivation from `:under-sourced:`.
   - Tests `NO-EVIDENCE` handling on non-existent topic.
2. **End-to-End Orchestrator Dry-Run:**
   - Execute Step 4 synthesis pass of `run-closed-loop-research-v2.mjs` against test gap cards and verify generated markdown structure.
