# CIC Docs / Governance Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remediate the findings from the 2026-09-26 CIC/Toolforge documentation-system audit
(Rev. 3, Codex-reviewed) — fix broken doc links, close the governance-corpus discoverability gap,
and draft (not unilaterally apply) the governance-state fixes that require Tier 1 ratification.

**Architecture:** No new runtime systems. This is documentation surgery plus one small generator
script (`gate-status-report`) that projects `gate-implementation-status.md` from the three
existing JSON registries instead of hand-editing it. Tier 1-gated items (operational-status
reconciliation, Codex-report artifact class, CIC-GOVERNANCE→MkDocs publication) are delivered as
**proposal documents for Chris to ratify**, not as applied changes — per
`CIC-GOV-MANIFEST-001.md:21` ("subordinate to Tier 1 decisions") and the audit's own Section 6
gating.

**Tech Stack:** Markdown, MkDocs (`mkdocs.yml`), Node.js (generator script + its test), `git`.

**Spec:** `docs/superpowers/specs/2026-09-26-cic-docs-governance-remediation-design.md` (this plan
implements the audit findings directly; no separate design doc exists yet — see Task 0).

## Global Constraints

- Never delete `docs/archive/projects/castironforge/` or any of its contents — it is 100%
  untracked by git (verified `git ls-files` count = 0) and may be the only copy on disk. Task 1
  is an investigation-only checklist, not a deletion.
- No task may change `CIC-GOVERNANCE/MANIFEST/gate-implementation-status.md`,
  `CIC-GOVERNANCE/README.md`, `runtime-status.json`, or `gate-registry.json` operational-status
  claims directly. Tasks that touch this territory produce a **proposal doc** under
  `CIC-GOVERNANCE/proposals/` for Tier 1 (Chris) to ratify — per
  `CIC-GOV-MANIFEST-001.md:21-22`.
- Kebab-case, lowercase, `.md` extension for all new files under `docs/meta/` — per
  `docs/meta/governance/documentation-policy.md`.
- Every new markdown link added by this plan must resolve to a file that exists on disk at the
  time of the commit that adds it (no forward-references to not-yet-created files).

---

### Task 0: Write the design doc this plan implements

**Files:**
- Create: `docs/superpowers/specs/2026-09-26-cic-docs-governance-remediation-design.md`

**Interfaces:**
- Consumes: the audit report text already produced in this session (Rev. 3, findings +
  recommendations, Codex-reviewed).
- Produces: a design doc other tasks in this plan cite as their source of truth.

- [ ] **Step 1: Write the design doc**

Content (verbatim structure):

```markdown
---
title: "CIC Docs / Governance Remediation — Design"
status: approved
date: 2026-09-26
---

# CIC Docs / Governance Remediation — Design

## Problem

The 2026-09-26 documentation audit (Codex-reviewed, Rev. 3) found:

1. `CIC_DOCS_INDEX.md` references 11 files that don't exist.
2. `docs/meta/governance/` is referenced by `CIC-GOVERNANCE/` and `GOVERNANCE.md` but has no
   reverse index — a reader there can't tell who depends on it.
3. `CIC-GOVERNANCE/README.md` says `NOT OPERATIONAL`; `runtime-status.json` and
   `gate-registry.json` say operational/active. Same system, contradicting claims.
4. `gate-implementation-status.md` is hand-synced against 3 JSON registries and has already
   drifted once (documented in its own text).
5. `CIC-GOVERNANCE/` (the actual ratified-state source) is absent from the published MkDocs
   site.
6. No durable Codex-validation-report artifact class exists.
7. `docs/archive/projects/castironforge/` (34,453 files) is 100% untracked by git — ownership
   and recoverability unconfirmed, must not be deleted blind.

## Approach

- Items 1-2: fix directly (additive documentation, no governance-authority change).
- Items 3, 5, 6: draft as **proposal documents** in `CIC-GOVERNANCE/proposals/` for Tier 1
  ratification. Do not change canonical status files.
- Item 4: build the generator script as a **candidate** (`--dry-run` by default, writes to a
  `.candidate.md` file) — do not wire it to overwrite the hand-maintained file until Tier 1
  approves cutover.
- Item 7: investigation checklist only, output is a findings doc, not a deletion.

## Out of scope

- Merging `docs/` and `rewrite-mcp/docs/` into one MkDocs instance (audit Section 6 workflow
  proposal #3) — separate, larger effort, not part of this remediation pass.
- Nav-completeness CI check — separate tooling effort.
```

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/specs/2026-09-26-cic-docs-governance-remediation-design.md
git commit -m "docs: add design doc for CIC docs/governance remediation"
```

---

### Task 1: Investigate `docs/archive/projects/castironforge/` ownership (no deletion)

**Files:**
- Create: `docs/meta/reviews/castironforge-archive-recoverability-findings.md`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: a findings doc that Task 2 references when deciding archive-vs-relocate (not part
  of this plan — that decision needs Tier 1 sign-off per the audit).

- [ ] **Step 1: Confirm the file is genuinely untracked (re-verify, don't trust a stale claim)**

Run: `cd /c/dev && git ls-files docs/archive/projects/castironforge | wc -l`
Expected: `0`

- [ ] **Step 2: Search for another copy on disk**

Run:
```bash
find /c/dev -maxdepth 3 -iname "*castironforge*" -not -path "*/docs/archive/*" 2>/dev/null
find /c -maxdepth 2 -iname "*castironforge*" 2>/dev/null
```
Record whatever is found (even "nothing found") in the findings doc — this is evidence, not a
decision.

- [ ] **Step 3: Check for it in any other git remote/history**

Run: `cd /c/dev && git log --all --diff-filter=A -- 'docs/archive/projects/castironforge/*' | head -5`
Expected: no output (confirms it was never committed, i.e. no history to recover from even if
deleted).

- [ ] **Step 4: Write the findings doc**

```markdown
# castironforge Archive — Recoverability Findings

Date: 2026-09-26

- Git-tracked files under `docs/archive/projects/castironforge/`: [paste Step 1 result]
- Other copies found on disk: [paste Step 2 result, or "none found"]
- Git history for this path (any repo): [paste Step 3 result, or "none — never committed"]

## Recommendation for Tier 1

[If no other copy found and no git history exists: this is the only copy. Recommend: do not
delete. Either (a) commit it properly if it has ongoing value, or (b) move it outside `docs/`
to a clearly-labeled non-doc location (e.g. `C:\dev\_cold-storage\castironforge\`) so it stops
polluting doc tooling, without destroying the only copy.]
```

- [ ] **Step 5: Commit**

```bash
git add docs/meta/reviews/castironforge-archive-recoverability-findings.md
git commit -m "docs: record castironforge archive recoverability findings (no deletion)"
```

---

### Task 2: Fix `CIC_DOCS_INDEX.md` dead links

**Files:**
- Modify: `rewrite-mcp/docs/cic/CIC_DOCS_INDEX.md`
- Test: `rewrite-mcp/scripts/check-doc-links.mjs` (new, reusable link checker)

**Interfaces:**
- Consumes: nothing.
- Produces: `check-doc-links.mjs <file>` — exits 0 if every relative markdown link in `<file>`
  resolves to an existing file (relative to the file's own directory), exits 1 and prints each
  broken link otherwise. Reused by Task 6.

- [ ] **Step 1: Write the failing check script**

```javascript
// rewrite-mcp/scripts/check-doc-links.mjs
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const target = process.argv[2];
if (!target) {
  console.error('usage: node check-doc-links.mjs <markdown-file>');
  process.exit(2);
}

const text = readFileSync(target, 'utf8');
const dir = dirname(target);
const linkRe = /\[[^\]]*\]\(([^)]+)\)/g;
const broken = [];
let match;
while ((match = linkRe.exec(text)) !== null) {
  const href = match[1];
  if (/^https?:\/\//.test(href) || href.startsWith('#')) continue;
  const clean = href.split('#')[0];
  if (!clean) continue;
  const resolved = resolve(dir, clean);
  if (!existsSync(resolved)) broken.push(href);
}

if (broken.length > 0) {
  console.error(`${broken.length} broken link(s) in ${target}:`);
  for (const b of broken) console.error(`  - ${b}`);
  process.exit(1);
}
console.log(`OK: all links in ${target} resolve.`);
process.exit(0);
```

- [ ] **Step 2: Run it against `CIC_DOCS_INDEX.md` to confirm it fails**

Run: `node rewrite-mcp/scripts/check-doc-links.mjs rewrite-mcp/docs/cic/CIC_DOCS_INDEX.md`
Expected: FAIL, lists 11 broken links (`CIC_SYSTEM.md`, `CIC_PROJECT_STATE.md`,
`CIC_MASTER_ROADMAP.md`, `manuals/ops_console.md`, `manuals/replay_engine.md`,
`manuals/dry_run.md`, `manuals/task_extractor.md`, `manuals/ideas_clusterer.md`,
`manuals/daily_digest.md`, `manuals/metrics_health.md`, `manuals/event_logging.md`).

- [ ] **Step 3: Fix `CIC_DOCS_INDEX.md` — remove the dead entries, add a scope banner**

Edit `rewrite-mcp/docs/cic/CIC_DOCS_INDEX.md`:
- At the top, add:
  ```markdown
  > **Scope note:** "CIC" here means Cast Iron Charlie (the documentary production system —
  > see `CIC_MASTER_SPEC.md`). This is unrelated to `CIC-GOVERNANCE/` at the repo root, which
  > governs an unrelated ingestion/lineage substrate. See
  > [glossary](../glossary.md) if you landed here looking for gate/amendment status.
  ```
- Remove the "Core System Reference" bullets that point at `CIC_SYSTEM.md`,
  `CIC_PROJECT_STATE.md`, `CIC_MASTER_ROADMAP.md` (files don't exist — do not stub them out;
  removing the claim is the fix, not inventing placeholder files).
- Remove the entire "Operational Manuals" section (all 8 `manuals/*.md` links) — none of those
  files exist and nothing in the repo indicates they were ever written.

- [ ] **Step 4: Run the checker again to confirm it passes**

Run: `node rewrite-mcp/scripts/check-doc-links.mjs rewrite-mcp/docs/cic/CIC_DOCS_INDEX.md`
Expected: `OK: all links in rewrite-mcp/docs/cic/CIC_DOCS_INDEX.md resolve.`

- [ ] **Step 5: Commit**

```bash
git add rewrite-mcp/scripts/check-doc-links.mjs rewrite-mcp/docs/cic/CIC_DOCS_INDEX.md
git commit -m "fix(docs): remove 11 dead links from CIC_DOCS_INDEX.md, add link checker"
```

---

### Task 3: CIC/CIC acronym glossary + header disambiguation

**Files:**
- Create: `rewrite-mcp/docs/glossary.md`
- Modify: `rewrite-mcp/docs/cic/CIC_MASTER_SPEC.md` (header only)
- Modify: `CIC-GOVERNANCE/SPEC/Spec_v2.4.0.md` (header only)
- Modify: `rewrite-mcp/mkdocs.yml` (add glossary to nav)

**Interfaces:**
- Consumes: Task 2's `check-doc-links.mjs` to verify the new glossary page's links resolve.
- Produces: `glossary.md`, linked from both spec headers.

- [ ] **Step 1: Create the glossary page**

```markdown
<!-- rewrite-mcp/docs/glossary.md -->
# Glossary

## CIC (two unrelated meanings — read carefully)

This repo uses "CIC" for two different systems. They share nothing except the acronym.

| | CIC = Cast Iron Charlie | CIC = governance substrate |
|---|---|---|
| What it is | Documentary film about Charles Sorensen; archival-research intelligence pipeline | Ingestion/lineage/gate governance runtime (rollback, actor registry, amendments) |
| Spec | [`CIC_MASTER_SPEC.md`](cic/CIC_MASTER_SPEC.md), v1.1.0 | `CIC-GOVERNANCE/SPEC/Spec_v2.4.0.md`, v2.4.0 (repo root, outside this site) |
| Docs index | [`CIC_DOCS_INDEX.md`](cic/CIC_DOCS_INDEX.md) | `CIC-GOVERNANCE/README.md` |

If you're looking for gate status, amendment ratification, or rollback semantics, you want the
**governance substrate**, not this documentary-pipeline doc tree.
```

- [ ] **Step 2: Add banner to `CIC_MASTER_SPEC.md`**

At the top of `rewrite-mcp/docs/cic/CIC_MASTER_SPEC.md`, immediately after the frontmatter:

```markdown
> **Note:** "CIC" here is Cast Iron Charlie (this documentary-production spec), unrelated to
> `CIC-GOVERNANCE`'s ingestion/gate substrate. See [glossary](../glossary.md).
```

- [ ] **Step 3: Add banner to `Spec_v2.4.0.md`**

At the top of `CIC-GOVERNANCE/SPEC/Spec_v2.4.0.md`, immediately after the frontmatter:

```markdown
> **Note:** "CIC" here is the ingestion/lineage governance substrate, unrelated to Cast Iron
> Charlie (the documentary-production pipeline documented under `rewrite-mcp/docs/cic/`). See
> `rewrite-mcp/docs/glossary.md` for the distinction.
```

- [ ] **Step 4: Add glossary to mkdocs nav**

Edit `rewrite-mcp/mkdocs.yml`, add right after `Overview: index.md`:

```yaml
  - Glossary: glossary.md
```

- [ ] **Step 5: Verify the new page's links resolve**

Run: `node rewrite-mcp/scripts/check-doc-links.mjs rewrite-mcp/docs/glossary.md`
Expected: `OK: all links in rewrite-mcp/docs/glossary.md resolve.`

- [ ] **Step 6: Commit**

```bash
git add rewrite-mcp/docs/glossary.md rewrite-mcp/docs/cic/CIC_MASTER_SPEC.md \
        CIC-GOVERNANCE/SPEC/Spec_v2.4.0.md rewrite-mcp/mkdocs.yml
git commit -m "docs: disambiguate CIC/CIC acronym collision with glossary + header banners"
```

---

### Task 4: Reverse-index for `docs/meta/governance/`

**Files:**
- Modify: `docs/meta/governance/README.md`

**Interfaces:**
- Consumes: nothing.
- Produces: a "Referenced by" section other tasks (none in this plan) can append to later.

- [ ] **Step 1: Confirm the two known external references still hold**

Run:
```bash
grep -n "docs/meta/governance" /c/dev/CIC-GOVERNANCE/MANIFEST/CIC-GOV-MANIFEST-001.md
grep -n "docs/meta/governance" /c/dev/GOVERNANCE.md
```
Expected: both print a matching line (confirms the citations below are accurate before writing
them down).

- [ ] **Step 2: Add the section to `docs/meta/governance/README.md`**

Append:

```markdown
## Referenced by

External surfaces that treat files in this directory as binding authority (update this list
when you find or add another):

- `CIC-GOVERNANCE/MANIFEST/CIC-GOV-MANIFEST-001.md` — cites
  `global-operating-rules-cic-rewrite-labs.md` as an authority the manifest is subordinate to.
- `GOVERNANCE.md` (repo root) — cites `wiki-style-and-structure.md` for wiki-lifecycle rules.
```

- [ ] **Step 3: Commit**

```bash
git add docs/meta/governance/README.md
git commit -m "docs: add reverse-index (Referenced by) section to docs/meta/governance/README.md"
```

---

### Task 5: `gate-implementation-status.md` generator (candidate, not wired live)

**Files:**
- Create: `CIC-GOVERNANCE/scripts/generate-gate-status.mjs`
- Create: `CIC-GOVERNANCE/tests/test_generate_gate_status.mjs`

**Interfaces:**
- Consumes: `CIC-GOVERNANCE/MANIFEST/gate-registry.json`, `AMENDMENTS/amendment-registry.json`,
  `MANIFEST/runtime-status.json` (read-only).
- Produces: `generateGateStatusMarkdown(registries): string` — pure function, no file I/O, so
  it's testable without touching the real registries. The CLI wrapper writes to
  `MANIFEST/gate-implementation-status.candidate.md`, never overwrites the real
  `gate-implementation-status.md`.

- [ ] **Step 1: Write the failing test**

```javascript
// CIC-GOVERNANCE/tests/test_generate_gate_status.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateGateStatusMarkdown } from '../scripts/generate-gate-status.mjs';

test('renders one row per gate with its closure amendment', () => {
  const gateRegistry = {
    status: 'STABLE / SEALED',
    gates: {
      'GATE-01': { name: 'Artifact-Store Transaction / Rollback', status: 'CLOSED', closure_amendment: 'AMD-v2.4.0-GATE-01-CLOSED' },
      'GATE-05': { name: 'Open-Gate Rejection', status: 'CLOSED', closure_amendment: 'AMD-v2.4.0-GATE-05-CLOSED' },
    },
  };
  const amendmentRegistry = { status: 'DRAFT', amendments: [] };
  const runtimeStatus = { status: 'OPERATIONAL' };

  const md = generateGateStatusMarkdown({ gateRegistry, amendmentRegistry, runtimeStatus });

  assert.match(md, /GATE-01/);
  assert.match(md, /AMD-v2\.4\.0-GATE-01-CLOSED/);
  assert.match(md, /GATE-05/);
  assert.match(md, /Gate registry status: STABLE \/ SEALED/);
  assert.match(md, /Runtime status \(runtime-status\.json\): OPERATIONAL/);
});

test('flags a gate with no closure amendment as OPEN, not silently omitted', () => {
  const gateRegistry = {
    status: 'CANDIDATE',
    gates: { 'GATE-09': { name: 'Hypothetical Open Gate', status: 'OPEN' } },
  };
  const md = generateGateStatusMarkdown({
    gateRegistry,
    amendmentRegistry: { status: 'DRAFT', amendments: [] },
    runtimeStatus: { status: 'CANDIDATE' },
  });
  assert.match(md, /GATE-09.*OPEN/);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test CIC-GOVERNANCE/tests/test_generate_gate_status.mjs`
Expected: FAIL — `generate-gate-status.mjs` does not exist yet.

- [ ] **Step 3: Write the generator**

```javascript
// CIC-GOVERNANCE/scripts/generate-gate-status.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export function generateGateStatusMarkdown({ gateRegistry, amendmentRegistry, runtimeStatus }) {
  const lines = [];
  lines.push('---');
  lines.push('title: "Gate Implementation Status (generated)"');
  lines.push('document_id: "CIC-GOV-GATE-STATUS"');
  lines.push('category: "manifest"');
  lines.push('generator: "CIC-GOVERNANCE/scripts/generate-gate-status.mjs"');
  lines.push('---');
  lines.push('');
  lines.push('# Gate Implementation Status');
  lines.push('');
  lines.push('> Generated from `gate-registry.json`, `amendment-registry.json`, and');
  lines.push('> `runtime-status.json`. Do not hand-edit — edit the source registries and');
  lines.push('> regenerate instead.');
  lines.push('');
  lines.push(`Gate registry status: ${gateRegistry.status}`);
  lines.push(`Amendment registry status: ${amendmentRegistry.status}`);
  lines.push(`Runtime status (runtime-status.json): ${runtimeStatus.status}`);
  lines.push('');
  lines.push('| Gate | Name | Status | Closure amendment |');
  lines.push('| --- | --- | --- | --- |');
  for (const [id, gate] of Object.entries(gateRegistry.gates ?? {})) {
    lines.push(`| ${id} | ${gate.name} | ${gate.status} | ${gate.closure_amendment ?? '(none — open)'} |`);
  }
  return lines.join('\n') + '\n';
}

function main() {
  const here = dirname(fileURLToPath(import.meta.url));
  const root = resolve(here, '..');
  const gateRegistry = JSON.parse(readFileSync(resolve(root, 'MANIFEST/gate-registry.json'), 'utf8'));
  const amendmentRegistry = JSON.parse(readFileSync(resolve(root, 'AMENDMENTS/amendment-registry.json'), 'utf8'));
  const runtimeStatus = JSON.parse(readFileSync(resolve(root, 'MANIFEST/runtime-status.json'), 'utf8'));
  const md = generateGateStatusMarkdown({ gateRegistry, amendmentRegistry, runtimeStatus });
  const outPath = resolve(root, 'MANIFEST/gate-implementation-status.candidate.md');
  writeFileSync(outPath, md);
  console.log(`Wrote ${outPath} — review and diff against gate-implementation-status.md before any cutover decision.`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test CIC-GOVERNANCE/tests/test_generate_gate_status.mjs`
Expected: PASS, 2/2.

- [ ] **Step 5: Run the CLI against the real registries and diff**

Run:
```bash
node CIC-GOVERNANCE/scripts/generate-gate-status.mjs
diff CIC-GOVERNANCE/MANIFEST/gate-implementation-status.md CIC-GOVERNANCE/MANIFEST/gate-implementation-status.candidate.md
```
Record the diff output in the proposal doc (Task 6) — this is the evidence Tier 1 needs to
decide on cutover. Do not delete `gate-implementation-status.candidate.md`; do not touch the
real file.

- [ ] **Step 6: Commit**

```bash
git add CIC-GOVERNANCE/scripts/generate-gate-status.mjs CIC-GOVERNANCE/tests/test_generate_gate_status.mjs
git commit -m "feat(cic-governance): add candidate gate-status generator (not wired live)"
```

Note: `gate-implementation-status.candidate.md` is a build output, not a source file — add it
to `CIC-GOVERNANCE/.gitignore` in this same commit so repeated runs don't create commit noise:

```bash
echo 'MANIFEST/gate-implementation-status.candidate.md' >> CIC-GOVERNANCE/.gitignore
git add CIC-GOVERNANCE/.gitignore
```

---

### Task 6: Tier 1 proposal doc — operational-status reconciliation + generator cutover + Codex-report artifact class + MkDocs publication

**Files:**
- Create: `CIC-GOVERNANCE/proposals/2026-09-26-docs-audit-remediation-proposal.md`

**Interfaces:**
- Consumes: Task 5's diff output, the audit's Rev. 3 findings.
- Produces: a single proposal doc bundling every Tier-1-gated decision from the audit, so Chris
  ratifies (or rejects) them together instead of four separate asks.

- [ ] **Step 1: Write the proposal doc**

```markdown
---
title: "Docs Audit Remediation — Tier 1 Proposal"
document_id: "PROPOSAL-2026-09-26-DOCS-AUDIT"
category: "proposal"
status: "awaiting Tier 1 review"
date: 2026-09-26
---

# Docs Audit Remediation — Tier 1 Proposal

Four decisions from the 2026-09-26 documentation audit (Codex-reviewed) need Tier 1 ratification
before they're applied. This doc bundles them for one review pass.

## Decision 1: Operational-status contradiction

`CIC-GOVERNANCE/README.md:12` says `IMPLEMENTED CANDIDATE — NOT OPERATIONAL`.
`MANIFEST/runtime-status.json` says `OPERATIONAL`. `MANIFEST/gate-registry.json:37` says
`runtime_active: true`. Pick one:

- **A.** README is stale — update it to reflect OPERATIONAL/active, matching the two
  machine-readable state files.
- **B.** The machine-readable files are premature — set `runtime-status.json` back to a
  non-operational state and `gate-registry.json`'s `runtime_active` to `false` until README's
  conditions are actually met.

No recommendation made here — this is a factual-state call only Tier 1 can make.

## Decision 2: Cut over `gate-implementation-status.md` to the generator

Task 5 built `CIC-GOVERNANCE/scripts/generate-gate-status.mjs`, a pure-function generator with
tests, driven by the three JSON registries. Diff against the current hand-written file:

```
[paste the `diff` output from Task 5 Step 5 here before submitting for review]
```

If approved: wire the generator into a pre-commit hook or CI step that regenerates
`gate-implementation-status.md` on every change to the three source registries, and delete the
hand-maintained-file assumption from this doc's own text.

## Decision 3: Codex-validation-report artifact class

No durable Codex report artifact exists — only `.tmp/codex-review-*.txt` (transient, untracked)
and `CIC-GOVERNANCE/logs/codex/*.log` (raw execution traces). Proposed: a new
`CIC-GOVERNANCE/tests/reports/codex-validation-<date>.json` schema mirroring the existing
`CIC-TEST-REPORT-GATE-*.json` pattern (same directory, same versioning convention). Needs
Tier 1 sign-off on: schema shape, retention period, and what triggers a new report (every Codex
gate run? Only on doc changes? Manual only?).

## Decision 4: Publish CIC-GOVERNANCE state to the MkDocs site

`CIC-GOVERNANCE/` is absent from `rewrite-mcp/mkdocs.yml` — the actual ratified/operational
state is unpublished. Proposed nav addition:

```yaml
  - Governance:
      - CIC-GOVERNANCE Status: cic-governance/index.md
      - Amendment Registry: cic-governance/amendments.md
      - Gate Registry: cic-governance/gates.md
```

Needs Tier 1 sign-off because publishing gate/amendment state externally-visible (even on an
internal MkDocs site) is a visibility-scope decision, not a pure doc fix.
```

- [ ] **Step 2: Commit**

```bash
git add CIC-GOVERNANCE/proposals/2026-09-26-docs-audit-remediation-proposal.md
git commit -m "docs(cic-governance): file Tier 1 proposal bundling 4 audit-driven decisions"
```

---

## Self-Review (run before handing off)

- **Spec coverage:** every numbered finding in the design doc (Task 0) maps to a task —
  1→Task 2, 2→Task 4, 3→Task 6 Decision 1, 4→Task 5+Task 6 Decision 2, 5→Task 6 Decision 4,
  6→Task 6 Decision 3, 7→Task 1. No gaps.
- **Placeholder scan:** no TBD/TODO, no "add appropriate error handling" — checked.
- **Type/name consistency:** `generateGateStatusMarkdown` name matches between Task 5's test
  and implementation; `check-doc-links.mjs` CLI signature (`node check-doc-links.mjs <file>`)
  matches between Task 2 (definition) and Task 3 Step 5 (reuse).

## Execution Handoff

Plan complete, saved to `docs/superpowers/plans/2026-09-26-cic-docs-governance-remediation.md`.
Two execution options:

1. **Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review each, fast
   iteration.
2. **Inline Execution** — execute tasks in this session via `executing-plans`, batched with
   checkpoints.

Which approach?
