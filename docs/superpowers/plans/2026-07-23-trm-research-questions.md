# TRM Research Questions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the pipeline that turns curator-approved TRM batches into research
questions, resolves the easy ones via web search, and rolls open items into a
per-topic focus-area list.

**Architecture:** Two pure file-in/file-out Node scripts (`scan-gaps.mjs`,
`update-focus-areas.mjs`) bracket a Claude-driven skill (`research-questions`)
that does the actual web search + confidence judgment. Scripts are
unit-tested with `node:test`; the skill is verified by a manual run against
real data (LLM judgment isn't unit-testable).

**Tech Stack:** Node.js (ESM, `.mjs`), `node:test` + `node:assert`, `node:crypto`
for hashing. No new dependencies.

## Global Constraints

- Vault holds all data files; repo holds only code (scripts + skill). Per
  spec: `docs/superpowers/specs/2026-07-23-trm-research-questions-design.md`.
- `scan-gaps.mjs` hard-errors (exit 1) on missing/malformed input — never
  writes partial output.
- `update-focus-areas.mjs` always writes `focus-areas.json`, even when empty.
- Field names are exact and must match across files: `source_type`,
  `fact_id`, `fact_confidence`, `question_origin_hash`, `status`,
  `search_attempt_count`, `search_terms_used`, `last_attempt`.

---

## File Structure

- **Create:** `src/harvester/external/scan-gaps.mjs` — reads
  `curator-decisions-final.json`, emits `draft-questions.json`.
- **Create:** `src/harvester/external/__tests__/scan-gaps.test.js` — unit
  tests for the above, using `node:test`.
- **Create:** `src/harvester/external/update-focus-areas.mjs` — reads
  `research-questions.json`, emits `focus-areas.json`.
- **Create:** `src/harvester/external/__tests__/update-focus-areas.test.js`
  — unit tests for the above.
- **Create:** `skills/research-questions/SKILL.md` — the Claude-driven
  enrichment step (web search + confidence judgment).
- **Modify:** `src/harvester/external/curator-decision-processor.mjs` — add
  one line to its final console output pointing to the next step.

---

### Task 1: `scan-gaps.mjs` — draft question generation

**Files:**
- Create: `src/harvester/external/scan-gaps.mjs`
- Test: `src/harvester/external/__tests__/scan-gaps.test.js`

**Interfaces:**
- Produces: `scanGaps(decisions, topic)` — pure function, exported from
  `scan-gaps.mjs`. `decisions` is the parsed contents of a
  `curator-decisions-final.json` file (shape: `{ batch_id, decisions: [{ photo_id, decision, topics, confidence, verified, flagged_for_research? }], attribution, verification_notes }`,
  matching `curator-decision-processor.mjs`'s existing input format).
  `topic` is a string. Returns a plain object matching the
  `draft-questions.json` shape from the spec:
  `{ topic, generated, questions: [{ id, source_type, fact_id, fact_confidence?, question, question_origin_hash, status: 'open' }] }`.
- Also produces: a CLI entry point (module-level code that runs only when
  the file is executed directly, guarded by
  `if (import.meta.url === \`file://${process.argv[1]}\`)`), invoked as:
  `node scan-gaps.mjs --decisions=<path> --topic=<name>`. Writes
  `draft-questions.json` into the same directory as the decisions file.

**Classification rules (in priority order):**
1. `flagged_for_research === true` on a decision → `source_type: 'curator-flagged'`.
2. `decision === 'new-fact'` → `source_type: 'gap'`.
3. `decision === 'link-to-fact' && confidence < 0.80` → `source_type: 'low-confidence'`.
4. Anything else (high-confidence links, rejects with no flag) → no question generated.

- [ ] **Step 1: Write the failing test**

Create `src/harvester/external/__tests__/scan-gaps.test.js`:

```javascript
import test from 'node:test';
import assert from 'node:assert';
import crypto from 'node:crypto';
import { scanGaps } from '../scan-gaps.mjs';

function fixtureDecisions() {
  return {
    batch_id: 'willow-run-001',
    decisions: [
      { photo_id: '75904', decision: 'link-to-fact', topics: ['willow-run'], confidence: 0.92, verified: true },
      { photo_id: '76100', decision: 'link-to-fact', topics: ['willow-run'], confidence: 0.72, verified: true },
      { photo_id: '78626', decision: 'new-fact', topics: ['willow-run'], confidence: 0.55, verified: false },
      { photo_id: '76500', decision: 'link-to-fact', topics: ['willow-run'], confidence: 0.95, verified: true, flagged_for_research: true }
    ],
    attribution: { source: 'Michigan Flight Museum' }
  };
}

test('scanGaps classifies gap, low-confidence, and curator-flagged decisions', () => {
  const result = scanGaps(fixtureDecisions(), 'willow-run');

  assert.strictEqual(result.topic, 'willow-run');
  assert.ok(result.generated);
  assert.strictEqual(result.questions.length, 3);

  const bySourceType = Object.fromEntries(result.questions.map(q => [q.source_type, q]));

  assert.ok(bySourceType['gap']);
  assert.strictEqual(bySourceType['gap'].fact_id, '78626');
  assert.strictEqual(bySourceType['gap'].status, 'open');

  assert.ok(bySourceType['low-confidence']);
  assert.strictEqual(bySourceType['low-confidence'].fact_id, '76100');
  assert.strictEqual(bySourceType['low-confidence'].fact_confidence, 0.72);

  assert.ok(bySourceType['curator-flagged']);
  assert.strictEqual(bySourceType['curator-flagged'].fact_id, '76500');
});

test('scanGaps skips high-confidence unflagged links and rejects', () => {
  const decisions = {
    batch_id: 'willow-run-001',
    decisions: [
      { photo_id: '75904', decision: 'link-to-fact', topics: ['willow-run'], confidence: 0.92, verified: true },
      { photo_id: '76001', decision: 'reject', topics: [], confidence: 0.10, verified: false }
    ]
  };
  const result = scanGaps(decisions, 'willow-run');
  assert.strictEqual(result.questions.length, 0);
});

test('scanGaps produces a stable question_origin_hash for identical input', () => {
  const decisions = fixtureDecisions();
  const first = scanGaps(decisions, 'willow-run');
  const second = scanGaps(decisions, 'willow-run');
  assert.strictEqual(first.questions[0].question_origin_hash, second.questions[0].question_origin_hash);
});

test('scanGaps changes question_origin_hash when the underlying decision changes', () => {
  const decisions = fixtureDecisions();
  const before = scanGaps(decisions, 'willow-run');

  decisions.decisions[1].confidence = 0.60;
  const after = scanGaps(decisions, 'willow-run');

  const beforeHash = before.questions.find(q => q.fact_id === '76100').question_origin_hash;
  const afterHash = after.questions.find(q => q.fact_id === '76100').question_origin_hash;
  assert.notStrictEqual(beforeHash, afterHash);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test src/harvester/external/__tests__/scan-gaps.test.js`
Expected: FAIL — `scan-gaps.mjs` does not exist / `scanGaps` is not exported.

- [ ] **Step 3: Write minimal implementation**

Create `src/harvester/external/scan-gaps.mjs`:

```javascript
#!/usr/bin/env node
/**
 * Scan Gaps
 * Reads curator-decisions-final.json, emits draft-questions.json:
 * one question per gap / low-confidence / curator-flagged decision.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const LOW_CONFIDENCE_THRESHOLD = 0.80;

function hashDecision(decision) {
  const material = JSON.stringify({
    photo_id: decision.photo_id,
    decision: decision.decision,
    confidence: decision.confidence,
    topics: decision.topics,
    flagged_for_research: decision.flagged_for_research || false
  });
  return 'sha256:' + crypto.createHash('sha256').update(material).digest('hex');
}

function classify(decision) {
  if (decision.flagged_for_research === true) return 'curator-flagged';
  if (decision.decision === 'new-fact') return 'gap';
  if (decision.decision === 'link-to-fact' && decision.confidence < LOW_CONFIDENCE_THRESHOLD) return 'low-confidence';
  return null;
}

function questionText(sourceType, decision) {
  const topics = (decision.topics || []).join(', ');
  if (sourceType === 'gap') {
    return `Photo ${decision.photo_id} was flagged as a new undocumented event — what TRM fact should it link to, or is it genuinely new?`;
  }
  if (sourceType === 'low-confidence') {
    return `Is the ${decision.confidence.toFixed(2)}-confidence link between photo ${decision.photo_id} and topics [${topics}] correct?`;
  }
  return `Curator flagged photo ${decision.photo_id} for additional research (topics: [${topics}]).`;
}

export function scanGaps(decisions, topic) {
  let counter = 0;
  const questions = [];

  for (const decision of decisions.decisions) {
    const sourceType = classify(decision);
    if (!sourceType) continue;

    counter++;
    const entry = {
      id: `q-${String(counter).padStart(4, '0')}`,
      source_type: sourceType,
      fact_id: decision.photo_id,
      question: questionText(sourceType, decision),
      question_origin_hash: hashDecision(decision),
      status: 'open'
    };
    if (typeof decision.confidence === 'number') {
      entry.fact_confidence = decision.confidence;
    }
    questions.push(entry);
  }

  return {
    topic,
    generated: new Date().toISOString(),
    questions
  };
}

// CLI entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const decisionsPath = args.find(a => a.startsWith('--decisions='))?.split('=')[1];
  const topic = args.find(a => a.startsWith('--topic='))?.split('=')[1];

  if (!decisionsPath || !fs.existsSync(decisionsPath)) {
    console.error('[ERROR] Missing or invalid --decisions path');
    process.exit(1);
  }
  if (!topic) {
    console.error('[ERROR] Missing --topic');
    process.exit(1);
  }

  const decisions = JSON.parse(fs.readFileSync(decisionsPath, 'utf8'));
  const draft = scanGaps(decisions, topic);

  const outPath = path.join(path.dirname(decisionsPath), 'draft-questions.json');
  fs.writeFileSync(outPath, JSON.stringify(draft, null, 2));

  console.log(`[OK] Generated ${draft.questions.length} draft questions`);
  console.log(`[OUTPUT] ${outPath}`);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test src/harvester/external/__tests__/scan-gaps.test.js`
Expected: PASS, all 4 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/harvester/external/scan-gaps.mjs src/harvester/external/__tests__/scan-gaps.test.js
git commit -m "feat(trm): add scan-gaps.mjs for draft research-question generation"
```

---

### Task 2: `update-focus-areas.mjs` — focus-area aggregation

**Files:**
- Create: `src/harvester/external/update-focus-areas.mjs`
- Test: `src/harvester/external/__tests__/update-focus-areas.test.js`

**Interfaces:**
- Consumes: `research-questions.json` shape produced by the
  `research-questions` skill (Task 3) — same shape as `draft-questions.json`
  from Task 1, with each question additionally carrying `status: 'open' |
  'closed' | 'escalated'` and, once processed, `answer`, `confidence`,
  `sources`, `escalation_reason`, `new_leads`, `search_attempt_count`,
  `search_terms_used`, `last_attempt`.
- Produces: `computeFocusAreas(researchQuestions)` — pure function,
  exported from `update-focus-areas.mjs`. Returns
  `{ topic, updated, focus_areas: [{ theme, open_question_count, priority }] }`.

**Theme grouping and priority (MVP rule — deliberately simple, no ML):**
- Group `open` + `escalated` questions by `source_type` (three possible
  themes: `"Undocumented events (gap)"`, `"Low-confidence links"`,
  `"Curator-flagged items"`). This is coarse by design — YAGNI; a
  smarter per-entity grouping can be added later if the coarse buckets
  prove too broad in practice.
- `open_question_count` = count of open+escalated questions in that bucket.
- Priority weighting: sum `(1 - fact_confidence)` for questions that carry
  `fact_confidence` (missing confidence counts as weight `1`, i.e. maximum
  uncertainty) within the bucket. `priority: 'high'` if the weighted sum
  is `>= 2`, else `'medium'` if `>= 1`, else `'low'`.
- Buckets with zero open+escalated questions are omitted from `focus_areas`
  (not included as zero-count entries).

- [ ] **Step 1: Write the failing test**

Create `src/harvester/external/__tests__/update-focus-areas.test.js`:

```javascript
import test from 'node:test';
import assert from 'node:assert';
import { computeFocusAreas } from '../update-focus-areas.mjs';

test('computeFocusAreas groups by source_type and ranks by weighted confidence', () => {
  const researchQuestions = {
    topic: 'willow-run',
    generated: '2026-07-23T00:00:00Z',
    questions: [
      { id: 'q-0001', source_type: 'gap', fact_id: '78626', status: 'open' },
      { id: 'q-0002', source_type: 'low-confidence', fact_id: '76100', fact_confidence: 0.72, status: 'open' },
      { id: 'q-0003', source_type: 'low-confidence', fact_id: '76200', fact_confidence: 0.60, status: 'escalated' },
      { id: 'q-0004', source_type: 'curator-flagged', fact_id: '76500', status: 'closed' }
    ]
  };

  const result = computeFocusAreas(researchQuestions);

  assert.strictEqual(result.topic, 'willow-run');
  assert.ok(result.updated);

  const byTheme = Object.fromEntries(result.focus_areas.map(f => [f.theme, f]));

  assert.strictEqual(byTheme['Undocumented events (gap)'].open_question_count, 1);
  assert.strictEqual(byTheme['Low-confidence links'].open_question_count, 2);
  assert.strictEqual(byTheme['Low-confidence links'].priority, 'high');
  assert.strictEqual(byTheme['Undocumented events (gap)'].priority, 'medium');

  assert.strictEqual(byTheme['Curator-flagged items'], undefined);
});

test('computeFocusAreas returns an empty array, not omission, when nothing is open', () => {
  const researchQuestions = {
    topic: 'willow-run',
    generated: '2026-07-23T00:00:00Z',
    questions: [
      { id: 'q-0001', source_type: 'gap', fact_id: '78626', status: 'closed' }
    ]
  };

  const result = computeFocusAreas(researchQuestions);
  assert.deepStrictEqual(result.focus_areas, []);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test src/harvester/external/__tests__/update-focus-areas.test.js`
Expected: FAIL — `update-focus-areas.mjs` does not exist.

- [ ] **Step 3: Write minimal implementation**

Create `src/harvester/external/update-focus-areas.mjs`:

```javascript
#!/usr/bin/env node
/**
 * Update Focus Areas
 * Reads research-questions.json, emits focus-areas.json:
 * open+escalated questions grouped by source_type, ranked by
 * confidence-weighted priority.
 */

import fs from 'fs';
import path from 'path';

const THEME_LABELS = {
  gap: 'Undocumented events (gap)',
  'low-confidence': 'Low-confidence links',
  'curator-flagged': 'Curator-flagged items'
};

function priorityFromWeight(weight) {
  if (weight >= 2) return 'high';
  if (weight >= 1) return 'medium';
  return 'low';
}

export function computeFocusAreas(researchQuestions) {
  const buckets = {};

  for (const q of researchQuestions.questions) {
    if (q.status !== 'open' && q.status !== 'escalated') continue;

    const theme = THEME_LABELS[q.source_type] || q.source_type;
    if (!buckets[theme]) {
      buckets[theme] = { count: 0, weight: 0 };
    }
    buckets[theme].count++;
    const uncertainty = typeof q.fact_confidence === 'number' ? (1 - q.fact_confidence) : 1;
    buckets[theme].weight += uncertainty;
  }

  const focus_areas = Object.entries(buckets).map(([theme, { count, weight }]) => ({
    theme,
    open_question_count: count,
    priority: priorityFromWeight(weight)
  }));

  return {
    topic: researchQuestions.topic,
    updated: new Date().toISOString(),
    focus_areas
  };
}

// CLI entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const questionsPath = args.find(a => a.startsWith('--questions='))?.split('=')[1];

  if (!questionsPath || !fs.existsSync(questionsPath)) {
    console.error('[ERROR] Missing or invalid --questions path');
    process.exit(1);
  }

  const researchQuestions = JSON.parse(fs.readFileSync(questionsPath, 'utf8'));
  const focusAreas = computeFocusAreas(researchQuestions);

  const outPath = path.join(path.dirname(questionsPath), 'focus-areas.json');
  fs.writeFileSync(outPath, JSON.stringify(focusAreas, null, 2));

  console.log(`[OK] Computed ${focusAreas.focus_areas.length} focus areas`);
  console.log(`[OUTPUT] ${outPath}`);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test src/harvester/external/__tests__/update-focus-areas.test.js`
Expected: PASS, both tests green.

- [ ] **Step 5: Commit**

```bash
git add src/harvester/external/update-focus-areas.mjs src/harvester/external/__tests__/update-focus-areas.test.js
git commit -m "feat(trm): add update-focus-areas.mjs for focus-area aggregation"
```

---

### Task 3: `research-questions` skill — web search + confidence judgment

**Files:**
- Create: `skills/research-questions/SKILL.md`

**Interfaces:**
- Consumes: `draft-questions.json` (Task 1 output shape) and, on rerun,
  any existing `research-questions.json` in the same directory (so already
  `closed` questions aren't re-searched).
- Produces: `research-questions.json` (same directory), matching the
  spec's augmented shape. Calls `update-focus-areas.mjs` (Task 2) as its
  last step.

This task is documentation, not code — the skill's logic is executed by
Claude directly (WebSearch + judgment), not by a script. There is no
failing-test step; this is not unit-testable. Verification is a manual run
against the real willow-run batch (Step 3 below).

- [ ] **Step 1: Write `skills/research-questions/SKILL.md`**

```markdown
---
name: research-questions
description: Generate and resolve TRM research questions from a curator-approved batch. Runs scan-gaps, does web search + confidence judgment per question, then recomputes focus areas. Trigger: /research-questions <topic>, or after curator-decision-processor finishes a batch.
---

# Research Questions

## Input

A topic name, e.g. `willow-run`. Locate the topic's ingest directory:
`C:\Users\soren\trm-vault\topics\charlie\<topic>\trm-ingest\`.
Requires `curator-decisions-final.json` to already exist there (output of
curator-decision-processor.mjs).

## Steps

1. **Generate draft questions.** Run:
   `node C:\dev\src\harvester\external\scan-gaps.mjs --decisions=<path to curator-decisions-final.json> --topic=<topic>`
   This writes `draft-questions.json` into the same directory.

2. **Load existing state.** If `research-questions.json` already exists in
   that directory, read it. Any question whose `id` + `question_origin_hash`
   matches an existing `closed` entry is already resolved — carry it
   forward unchanged, do not re-search it. Any question with a new or
   changed `question_origin_hash` (or not present before) needs processing
   as below. This is what makes reruns incremental instead of re-asking
   settled questions.

3. **For each `open` question needing processing:**
   - Run WebSearch using the question text (and `fact_id`/topic as
     context) as the query. Record the exact query string(s) tried in
     `search_terms_used`.
   - Increment `search_attempt_count` (starts at 0, so first attempt = 1).
   - Judge the search results yourself:
     - If results clearly and specifically answer the question with a
       source you'd trust: set `status: 'closed'`, `answer` (your
       synthesized answer), `confidence: 'high'`, `sources` (the URLs that
       support it).
     - If results are thin, contradictory, or off-topic: set
       `status: 'escalated'`, `escalation_reason` (why — e.g. "no sources
       mention this photo directly" or "two sources disagree on date"),
       keep any partial `answer` you can offer with `confidence: 'low'`.
     - If the search errored or returned nothing at all: leave
       `status: 'open'`, just update `search_attempt_count`,
       `search_terms_used`, and `last_attempt`. Do not force a
       closed/escalated verdict on a failed search — that's a rule from
       the design spec, not a judgment call.
   - If a search result surfaces a new unknown not covered by any existing
     question (e.g. a name or date mentioned that raises its own
     question), append it to that question's `new_leads` array as a plain
     string. Do not silently drop it, and do not create a new top-level
     question entry for it in this pass — `new_leads` is picked up as
     input the next time `scan-gaps.mjs`-equivalent triage happens on this
     topic (future enhancement; for now it's just recorded).
   - Set `last_attempt` to the current ISO timestamp regardless of outcome.

4. **Write `research-questions.json`** in the topic's `trm-ingest/`
   directory: the full question list (open, closed, and escalated),
   matching the augmented shape from the design spec.

5. **Recompute focus areas.** Run:
   `node C:\dev\src\harvester\external\update-focus-areas.mjs --questions=<path to research-questions.json>`
   This writes `focus-areas.json` into the same directory.

6. **Report to the user:** how many questions were closed / escalated /
   still open, and the resulting focus areas ranked by priority.

## Error handling

- If `curator-decisions-final.json` is missing, tell the user and stop —
  do not fabricate a batch.
- If `scan-gaps.mjs` or `update-focus-areas.mjs` exit non-zero, surface
  the exact stderr to the user and stop; do not attempt to hand-write the
  JSON yourself as a substitute for a script failure.
- Per-topic failures in a scheduled sweep (multiple topics processed in
  one invocation) must not stop the remaining topics — log which topic
  failed and continue to the next.
```

- [ ] **Step 2: No automated test (documented above — this step is
  intentionally a no-op checkbox to keep the plan's step numbering
  consistent with other tasks; nothing to run here).**

- [ ] **Step 3: Manual verification run**

Using the real willow-run batch at
`C:\Users\soren\trm-vault\topics\charlie\willow-run\trm-ingest\curator-decisions-final.json`,
invoke the skill (`/research-questions willow-run`) and confirm by eye:
- `draft-questions.json`, `research-questions.json`, and `focus-areas.json`
  all appear in the topic's `trm-ingest/` directory.
- Every question in `research-questions.json` has a `status` of `open`,
  `closed`, or `escalated` — none left in an intermediate/undefined state.
- `focus-areas.json` matches the `computeFocusAreas` grouping rules from
  Task 2 given the actual question set produced.

- [ ] **Step 4: Commit**

```bash
git add skills/research-questions/SKILL.md
git commit -m "feat(trm): add research-questions skill for web-search enrichment"
```

---

### Task 4: Wire the handoff hint into `curator-decision-processor.mjs`

**Files:**
- Modify: `src/harvester/external/curator-decision-processor.mjs:174-176`

**Interfaces:**
- No new exports. Purely an added console line; does not change the
  script's file outputs or exit behavior.

- [ ] **Step 1: Add the handoff line**

In `src/harvester/external/curator-decision-processor.mjs`, replace the
final three `console.log` lines (currently lines 174-176):

```javascript
console.log('\n================================================================');
console.log('Curator decisions processed. Ready for TRM fact creation.');
console.log('================================================================\n');
```

with:

```javascript
console.log('\n================================================================');
console.log('Curator decisions processed. Ready for TRM fact creation.');
console.log(`Next: run /research-questions ${decisions.batch_id.replace(/-\d+$/, '')}`);
console.log('================================================================\n');
```

- [ ] **Step 2: Manually verify the output line**

Run: `node src/harvester/external/curator-decision-processor.mjs --decisions=<any existing curator-decisions-final.json path>`
Expected: final output block includes a `Next: run /research-questions <topic>`
line, with `<topic>` derived by stripping a trailing `-NNN` batch suffix
from `batch_id` (e.g. `willow-run-001` → `willow-run`).

- [ ] **Step 3: Commit**

```bash
git add src/harvester/external/curator-decision-processor.mjs
git commit -m "feat(trm): print research-questions handoff hint after curator processing"
```

---

## Self-Review Notes

- **Spec coverage:** scan-gaps (spec Component 1) → Task 1. skill
  (Component 2) → Task 3. update-focus-areas (Component 3) → Task 2.
  Trigger modes: manual and scheduled are just skill invocations (no
  separate task needed — same entry point); chained-after-curator → Task 4.
  Error handling and data formats from the spec are embedded directly in
  each task's implementation. Roadmap doc is already written and committed
  separately (out of scope for this plan).
- **Placeholder scan:** no TBD/TODO; all code blocks are complete and
  runnable as written.
- **Type consistency:** `source_type` values (`gap`, `low-confidence`,
  `curator-flagged`) match exactly between Task 1's `classify()` and
  Task 2's `THEME_LABELS` keys. `fact_confidence`, `question_origin_hash`,
  `search_attempt_count`, `search_terms_used` field names match the spec
  verbatim and are consistent between the script (Task 1/2) and skill
  (Task 3) descriptions.
