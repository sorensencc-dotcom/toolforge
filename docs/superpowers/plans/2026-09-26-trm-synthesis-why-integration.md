# TRM Closed-Loop Synthesis `/why` Evidence Integration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement `modules/wiki/why-verifier.mjs` and wire it into `scripts/run-closed-loop-research-v2.mjs` (Step 4) so synthesized Layer 2 wiki notes are grounded in TRM vault gap cards with `verification_status` frontmatter and `## WHY-EVIDENCE` provenance blocks.

**Architecture:** Pure Node.js ES module `why-verifier.mjs` providing `verifyTopicGaps` (two-mode matching: category vs topic/notebook) and `formatWhyEvidenceBlock`. Integrated into `run-closed-loop-research-v2.mjs` Step 4 to enrich synthesized pages and preserve contradiction banners. Verified with a standalone test suite `modules/wiki/why-verifier.test.mjs`.

**Tech Stack:** Node.js (ESM), JavaScript, Markdown, TRM Research Vault (`C:\Users\soren\trm-vault\trm\research-gaps\`).

## Global Constraints

- Module lives at `modules/wiki/why-verifier.mjs` (ESM format matching existing codebase)
- Zero external dependencies — use native `fs`, `path`
- All paths written to frontmatter or markdown must be normalized to POSIX forward slashes (`/`)
- Two-mode matching: Category mode (`:${slug}:` in entry key) vs Topic/Notebook mode (filename or row noun-phrase match)
- Status hierarchy: `contradiction_flagged` > `single-sourced` > `verified` > `unverified`
- `why_corroborated: true` when matching claims appear in ≥2 distinct gap files
- Contradiction warning banner injected when `contradictions.length > 0`

---

### Task 1: Create `modules/wiki/why-verifier.mjs`

**Files:**
- Create: `modules/wiki/why-verifier.mjs`

**Interfaces:**
- Consumes: `fs`, `path`
- Produces: `verifyTopicGaps(topicSlug, options)`, `formatWhyEvidenceBlock(result)`

- [ ] **Step 1: Write `modules/wiki/why-verifier.mjs`**

Implement `verifyTopicGaps` and `formatWhyEvidenceBlock` supporting:
- Category mode vs Topic/Notebook mode
- Options: `vaultPath`, `gapsFilePath`, `gapsContent`
- Parsing gap card table rows (`| Question | Answer excerpt | Notebook | First-seen date | Entry key |`)
- Extracting entry key flags (`:open-contradictions:`, `:under-sourced:`)
- Generating clean markdown `<details>` blocks

- [ ] **Step 2: Commit**

```bash
git add modules/wiki/why-verifier.mjs
git commit -m "feat(wiki): add why-verifier module for TRM evidence grounding"
```

---

### Task 2: Create Test Suite `modules/wiki/why-verifier.test.mjs` and Verify

**Files:**
- Create: `modules/wiki/why-verifier.test.mjs`

**Interfaces:**
- Consumes: `modules/wiki/why-verifier.mjs`
- Produces: Test runner asserting category matching, topic matching, contradiction flagging, and no-evidence handling.

- [ ] **Step 1: Write `modules/wiki/why-verifier.test.mjs`**

Implement automated test cases:
1. Category matching (`open-contradictions`, `under-sourced`, `adjacent-topics`, `follow-up`).
2. Specific topic/notebook matching (`cic-willow-run-aviation-engineering`).
3. Single-sourced detection (`:under-sourced:`).
4. Contradiction detection (`:open-contradictions:`).
5. Non-existent topic handling (`NO-EVIDENCE` / `unverified`).
6. POSIX path normalization check.

- [ ] **Step 2: Run test suite**

```bash
node modules/wiki/why-verifier.test.mjs
```

Expected: All assertions pass with exit code 0.

- [ ] **Step 3: Commit**

```bash
git add modules/wiki/why-verifier.test.mjs
git commit -m "test(wiki): add unit test suite for why-verifier"
```

---

### Task 3: Integrate into `scripts/run-closed-loop-research-v2.mjs` (Step 4)

**Files:**
- Modify: `scripts/run-closed-loop-research-v2.mjs:397-440`

**Interfaces:**
- Consumes: `verifyTopicGaps`, `formatWhyEvidenceBlock` from `../modules/wiki/why-verifier.mjs`
- Produces: Enriched `wiki/research/${slug}.md` files with `verification_status`, `why_corroborated`, contradiction banners, and `## WHY-EVIDENCE` blocks.

- [ ] **Step 1: Import `why-verifier.mjs` in `run-closed-loop-research-v2.mjs`**

Add top-level import:
```javascript
import { verifyTopicGaps, formatWhyEvidenceBlock } from '../modules/wiki/why-verifier.mjs';
```

- [ ] **Step 2: Update Step 4 Wiki Synthesis loop**

In Step 4 loop, for each `slug` in `gapHeadings`:
- Call `verifyTopicGaps(slug, { vaultPath: TRM_VAULT, gapsFilePath: primaryGapsFile, gapsContent: primaryGapsContent })`
- Populate frontmatter: `verification_status: whyResult.verificationStatus`, `why_corroborated: whyResult.corroborated`
- Prepend contradiction warning banner if `whyResult.contradictions.length > 0`
- Append `whyResult.evidenceBlockMarkdown` inside the `<details>` wrapper at the bottom of the synthesized note.

- [ ] **Step 3: Test dry run of closed-loop synthesis**

```powershell
$env:BFCL_DRY_RUN="1"; $env:TRM_SKIP_MINE="1"; node scripts/run-closed-loop-research-v2.mjs
```

Expected: Step 4 logs show verification status per topic; synthesized files in `wiki/research/` carry frontmatter and `## WHY-EVIDENCE` blocks.

- [ ] **Step 4: Commit**

```bash
git add scripts/run-closed-loop-research-v2.mjs
git commit -m "feat(trm): integrate why-verifier into Step 4 Layer 2 wiki synthesis"
```

---

## Self-Review

1. **Spec Coverage:**
   - `modules/wiki/why-verifier.mjs` → Task 1
   - Two-mode matching & options override → Task 1
   - Unit test suite → Task 2
   - Step 4 integration in `run-closed-loop-research-v2.mjs` → Task 3
   - Contradiction banner & frontmatter tags → Task 3
2. **Placeholder scan:** Clean. All steps contain concrete files, signatures, and commands.
3. **Type consistency:** Function signatures match across `why-verifier.mjs`, `why-verifier.test.mjs`, and `run-closed-loop-research-v2.mjs`.
