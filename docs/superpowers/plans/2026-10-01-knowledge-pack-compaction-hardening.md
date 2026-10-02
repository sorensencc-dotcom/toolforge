# Knowledge Pack Compaction & Ingestion Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden `scripts/consolidate-pack.mjs` with lossless whitespace compaction, strict $\le 380\text{ KiB}$ paragraph-aware document splitting, verified staging directory isolation, and preserved multi-thematic pack partitioning.

**Architecture:** Maintain the existing `consolidatePacks()` and `THEMATIC_PACK_MAP` pipeline. Add a non-destructive whitespace compaction transformer (`normalizeWhitespace()`) that executes *after* frontmatter parsing, upgrade `partitionPackItems()` to split oversized individual files ($> 380\text{ KiB}$) on paragraph boundaries, and reinforce test coverage to ensure zero formatting or frontmatter corruption.

**Tech Stack:** Node.js (ESM), `node:crypto`, `node:fs`, `node:path`, Node native test runner (`node:test`, `node:assert`).

## Global Constraints

- Never perform destructive regex word-level removals (`in order to`, etc.) on Markdown prose.
- Never strip or modify Markdown frontmatter delimiters (`---`) or nested YAML properties.
- Strictly enforce the hard byte ceiling of 389,120 bytes (380 KiB) per pack chunk.
- Output directory must default to `.nlm_pack/`.
- Preserve all existing public exports (`consolidatePacks`, `getCanonicalPacks`, `extractFrontmatter`, `partitionPackItems`, `MAX_PACK_BYTES`).

---

### Task 1: Comprehensive Hardening Test Suite for Consolidate-Pack

**Files:**
- Create: `tests/consolidate-pack-hardening.test.mjs`
- Reference: `scripts/consolidate-pack.mjs`

**Interfaces:**
- Consumes: `consolidatePacks`, `extractFrontmatter`, `partitionPackItems`, `MAX_PACK_BYTES` from `scripts/consolidate-pack.mjs`
- Produces: Test harness covering frontmatter preservation, table/list indentation retention, single-file oversized chunk splitting, staging directory isolation, and thematic pack emission.

- [ ] **Step 1: Write the failing tests**
Write unit tests asserting:
1. `extractFrontmatter` and `serializePackItem` preserve YAML frontmatter intact.
2. Indented code blocks, nested Markdown lists (`-` and `  -`), and pipe tables retain exact whitespace.
3. An individual file with 450 KiB of text gets split across paragraph boundaries into $\le 380\text{ KiB}$ chunks instead of throwing or overflowing.
4. `_kb-sync-staging` and `.txt` files are excluded from discovery.

- [ ] **Step 2: Run test suite to verify initial failures**
Run: `node --test tests/consolidate-pack-hardening.test.mjs`
Verify that oversized single-file partitioning fails (or is unhandled).

- [ ] **Step 3: Commit initial test suite**
Run: `git add tests/consolidate-pack-hardening.test.mjs && git commit -m "test(pack): add comprehensive consolidation hardening test suite"`

---

### Task 2: Lossless Whitespace Compactor & Frontmatter Safety

**Files:**
- Modify: `scripts/consolidate-pack.mjs`
- Test: `tests/consolidate-pack-hardening.test.mjs`

**Interfaces:**
- Consumes: Raw Markdown content and extracted frontmatter.
- Produces: `normalizeWhitespace(content)` returning compacted prose without trailing whitespace or 3+ consecutive newlines.

- [ ] **Step 1: Implement `normalizeWhitespace` utility**
In `scripts/consolidate-pack.mjs`:
```javascript
export function normalizeWhitespace(content) {
  if (typeof content !== 'string') return '';
  return content
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
```

- [ ] **Step 2: Wire normalization into `serializePackItem`**
Apply `normalizeWhitespace()` strictly to the body content after `extractFrontmatter()` has completed, preserving provenance headers and code blocks.

- [ ] **Step 3: Verify formatting preservation tests pass**
Run: `node --test tests/consolidate-pack-hardening.test.mjs`

- [ ] **Step 4: Commit whitespace normalization**
Run: `git add scripts/consolidate-pack.mjs && git commit -m "feat(pack): add lossless whitespace normalization to consolidate-pack"`

---

### Task 3: Paragraph-Aware Budget Splitting for Oversized Files

**Files:**
- Modify: `scripts/consolidate-pack.mjs`
- Test: `tests/consolidate-pack-hardening.test.mjs`

**Interfaces:**
- Consumes: `items` array where individual items may exceed `MAX_PACK_BYTES`.
- Produces: `partitionPackItems(items, maxBytes, options)` that splits oversized items across paragraph boundaries into multiple compliant pack items.

- [ ] **Step 1: Implement sub-document paragraph chunking in `partitionPackItems`**
When an individual item serialized payload exceeds `maxBytes`, split its body text on `\n\n` paragraphs, creating sub-parts (`item.relPath (part 1)`, `item.relPath (part 2)`) so every emitted chunk remains $\le \text{maxBytes}$.

- [ ] **Step 2: Run hardening test suite**
Run: `node --test tests/consolidate-pack-hardening.test.mjs`
Verify all budget ceiling tests pass.

- [ ] **Step 3: Commit partitioning update**
Run: `git add scripts/consolidate-pack.mjs && git commit -m "fix(pack): partition oversized single files on paragraph boundaries"`

---

### Task 4: Full End-to-End Regression & Verification

**Files:**
- Test: `tests/consolidate-pack-hardening.test.mjs`
- Test: `tests/core-scripts-verification.ts` (if applicable)
- Verify: `.nlm_pack/` outputs via `node scripts/consolidate-pack.mjs`

**Interfaces:**
- Consumes: Complete `kb-sync` wiki repository sources.
- Produces: Verified `.nlm_pack/pack_*.txt` files conforming to category map and $\le 380\text{ KiB}$ size limit.

- [ ] **Step 1: Execute full test suite**
Run: `npm test`
Verify all 230+ tests pass with zero regressions.

- [ ] **Step 2: Dry-run consolidate pack**
Run: `node scripts/consolidate-pack.mjs`
Verify that output files in `.nlm_pack/` (`pack_willow_run.txt`, `pack_ford_politics.txt`, `pack_post_war.txt`, `pack_cuban_seizures.txt`, `pack_master_kb_part*.txt`) are strictly $\le 389,120\text{ bytes}$.

- [ ] **Step 3: Commit final verification artifact**
Run: `git add . && git commit -m "chore(pack): verify end-to-end pack consolidation and budget conformance"`
