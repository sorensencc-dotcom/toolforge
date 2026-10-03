# Deterministic Ticket Scorer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a zero-network, deterministic Markdown ticket scoring module at `modules/ticket-scorer/` that computes structural completeness, actionability, urgency signals, and domain relevance on a 0–100 scale, mapping tickets into discrete priority tiers (`P0`–`P3`).

**Architecture:** The module parses Markdown documents into a Unist AST via `unified` and `remark-parse` in a single traversal pass, extracts structural metrics (headings, checklist counts, code fences), applies a bounded lookback negation and clause-isolation normalizer to evaluate urgency and domain keywords, computes weighted dimension scores, and resolves the priority tier with P0 keyword floor overrides.

**Tech Stack:** TypeScript (ESM, Node 18+), `unified`, `remark-parse`, `unist-util-visit`, `@types/unist`, native Node.js test runner (`node:test`, `node:assert`), `tsx` for test execution.

## Global Constraints

- Module location: `modules/ticket-scorer/`
- Zero external inference or network dependencies (deterministic local execution)
- Native Node.js test runner (`node:test` + `node:assert`)
- Scoring rubric: Completeness (max 35), Urgency (max 30), Domain Scope (max 20), Actionability (max 15)
- Priority tiers: P0 ($\ge 80$), P1 ($60–79$), P2 ($35–59$), P3 ($< 35$)
- Floor override: Any normalized `KEYWORD_<NAME>` matching `overrideP0Keywords` (default: `panic`, `regression`, `corrupt`) forces `P0`

---

### Task 1: Package Scaffolding and Types Definition

**Files:**
- Create: `modules/ticket-scorer/package.json`
- Create: `modules/ticket-scorer/tsconfig.json`
- Create: `modules/ticket-scorer/src/types.ts`
- Test: `modules/ticket-scorer/tests/types.test.ts`

**Interfaces:**
- Consumes: None
- Produces: `PriorityTier`, `ScoreBreakdown`, `TicketScoreResult`, `ScorerConfig`, `ScorerOptions`, `DEFAULT_CONFIG`

- [ ] **Step 1: Create package.json and tsconfig.json**

Create `modules/ticket-scorer/package.json`:
```json
{
  "name": "@toolforge/ticket-scorer",
  "version": "1.0.0",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "test": "tsx --test tests/**/*.test.ts"
  },
  "dependencies": {
    "remark-parse": "^11.0.0",
    "unified": "^11.0.5",
    "unist-util-visit": "^5.0.0"
  },
  "devDependencies": {
    "@types/node": "^22.5.4",
    "@types/unist": "^3.0.3",
    "tsx": "^4.19.0",
    "typescript": "^5.5.4"
  }
}
```

Create `modules/ticket-scorer/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "declaration": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

- [ ] **Step 2: Write failing test for type contract and defaults**

Create `modules/ticket-scorer/tests/types.test.ts`:
```typescript
import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_CONFIG } from '../src/types.js';

test('DEFAULT_CONFIG exports valid rubric defaults', () => {
  assert.equal(DEFAULT_CONFIG.minBodyWordCount, 20);
  assert.ok(DEFAULT_CONFIG.knownDomains.includes('engine'));
  assert.ok(DEFAULT_CONFIG.knownDomains.includes('governance'));
  assert.equal(DEFAULT_CONFIG.urgencyKeywords.critical, 12);
  assert.equal(DEFAULT_CONFIG.urgencyKeywords.panic, 15);
  assert.equal(DEFAULT_CONFIG.urgencyKeywords.corrupt, 15);
  assert.ok(DEFAULT_CONFIG.overrideP0Keywords.includes('panic'));
  assert.ok(DEFAULT_CONFIG.overrideP0Keywords.includes('regression'));
  assert.equal(DEFAULT_CONFIG.scoreThresholds.p0, 80);
  assert.equal(DEFAULT_CONFIG.scoreThresholds.p1, 60);
  assert.equal(DEFAULT_CONFIG.scoreThresholds.p2, 35);
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx tsx --test modules/ticket-scorer/tests/types.test.ts`
Expected: FAIL with "Cannot find module '../src/types.js'"

- [ ] **Step 4: Implement `src/types.ts`**

Create `modules/ticket-scorer/src/types.ts`:
```typescript
export type PriorityTier = 'P0' | 'P1' | 'P2' | 'P3';

export interface ScoreBreakdown {
  completeness: number;  // 0 - 35
  urgency: number;       // 0 - 30
  domainScope: number;   // 0 - 20
  actionability: number; // 0 - 15
}

export interface TicketScoreResult {
  totalScore: number;     // 0 - 100
  tier: PriorityTier;
  breakdown: ScoreBreakdown;
  flags: string[];
}

export interface ScorerConfig {
  knownDomains: string[];
  urgencyKeywords: Record<string, number>;
  minBodyWordCount: number;
  overrideP0Keywords: string[];
  scoreThresholds: {
    p0: number;
    p1: number;
    p2: number;
  };
}

export type ScorerOptions = Partial<Omit<ScorerConfig, 'scoreThresholds'>> & {
  scoreThresholds?: Partial<ScorerConfig['scoreThresholds']>;
};

export const DEFAULT_CONFIG: ScorerConfig = {
  knownDomains: [
    'core',
    'engine',
    'governance',
    'sync',
    'ledger',
    'ast',
    'cli',
    'auth',
  ],
  urgencyKeywords: {
    corrupt: 15,
    panic: 15,
    critical: 12,
    blocker: 12,
    blocking: 10,
    regression: 10,
    leak: 10,
    urgent: 8,
    asap: 6,
    fixme: 4,
  },
  minBodyWordCount: 20,
  overrideP0Keywords: ['panic', 'regression', 'corrupt'],
  scoreThresholds: {
    p0: 80,
    p1: 60,
    p2: 35,
  },
};
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx tsx --test modules/ticket-scorer/tests/types.test.ts`
Expected: PASS with 1 passing test

- [ ] **Step 6: Commit**

```bash
git add modules/ticket-scorer/package.json modules/ticket-scorer/tsconfig.json modules/ticket-scorer/src/types.ts modules/ticket-scorer/tests/types.test.ts
git commit -m "feat(ticket-scorer): add package scaffolding, tsconfig, and core types"
```

---

### Task 2: Negation Matcher and Clause Normalizer

**Files:**
- Create: `modules/ticket-scorer/src/negation-matcher.ts`
- Create: `modules/ticket-scorer/tests/negation.test.ts`

**Interfaces:**
- Consumes: None
- Produces: `hasAffirmativeMatch(text: string, keyword: string): boolean`, `normalizeClause(rawClause: string): string`

- [ ] **Step 1: Write comprehensive failing tests for negation matcher**

Create `modules/ticket-scorer/tests/negation.test.ts`:
```typescript
import test from 'node:test';
import assert from 'node:assert/strict';
import { hasAffirmativeMatch, normalizeClause } from '../src/negation-matcher.js';

test('normalizeClause removes parentheticals, quotes, brackets, and extra spaces', () => {
  assert.equal(
    normalizeClause('not (strictly speaking) critical'),
    'not critical'
  );
  assert.equal(
    normalizeClause("not 'in our view' a blocker"),
    'not in our view a blocker'
  );
  assert.equal(
    normalizeClause('tested [no errors] clean'),
    'tested clean'
  );
});

test('hasAffirmativeMatch rejects hyphenated negations', () => {
  assert.equal(hasAffirmativeMatch('This is non-blocking and can wait.', 'blocking'), false);
  assert.equal(hasAffirmativeMatch('Non-critical update needed.', 'critical'), false);
  assert.equal(hasAffirmativeMatch('This is noncritical.', 'critical'), false);
});

test('hasAffirmativeMatch rejects adverbial negations in same clause', () => {
  assert.equal(hasAffirmativeMatch('This is not critical for the milestone.', 'critical'), false);
  assert.equal(hasAffirmativeMatch('There is no leak in the database worker.', 'leak'), false);
  assert.equal(hasAffirmativeMatch("It isn't a regression, just a refactor.", 'regression'), false);
  assert.equal(hasAffirmativeMatch('This is without a blocker, ready to ship.', 'blocker'), false);
  assert.equal(hasAffirmativeMatch('This is not (strictly speaking) critical.', 'critical'), false);
  assert.equal(hasAffirmativeMatch("Service is not 'critically' blocked.", 'blocked'), false);
  assert.equal(hasAffirmativeMatch('There is no `leak` in memory allocation.', 'leak'), false);
});

test('hasAffirmativeMatch preserves clause boundaries across punctuation', () => {
  assert.equal(hasAffirmativeMatch('Did not run. Critical error occurred.', 'critical'), true);
  assert.equal(hasAffirmativeMatch('Nothing broken;\nblocking issue identified in sync.', 'blocking'), true);
  assert.equal(hasAffirmativeMatch('No issues in staging! Urgent fix needed in prod.', 'urgent'), true);
  assert.equal(hasAffirmativeMatch('Did not repro? Panic observed on rerun.', 'panic'), true);
  assert.equal(hasAffirmativeMatch('Did not test\nCritical crash during boot', 'critical'), true);
  assert.equal(hasAffirmativeMatch('Did not finish (phase 1). Critical failure on boot.', 'critical'), true);
});

test('hasAffirmativeMatch recognizes genuine affirmatives', () => {
  assert.equal(hasAffirmativeMatch('This is critical: database deadlocks on ingress.', 'critical'), true);
  assert.equal(hasAffirmativeMatch('Observed a memory leak in sync worker.', 'leak'), true);
  assert.equal(hasAffirmativeMatch('Not ideal, but critical issue needs triage.', 'critical'), true);
  assert.equal(hasAffirmativeMatch('Identified a (very) critical issue.', 'critical'), true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test modules/ticket-scorer/tests/negation.test.ts`
Expected: FAIL with "Cannot find module '../src/negation-matcher.js'"

- [ ] **Step 3: Implement `src/negation-matcher.ts`**

Create `modules/ticket-scorer/src/negation-matcher.ts`:
```typescript
// Matches balanced parentheticals: (content), [content], {content}
const BALANCED_PARENTHETICAL_REGEX = /\([^)]*\)|\[[^\]]*\]|\{[^}]*\}/g;

// Matches quotes, backticks, residual brackets, and non-terminal pause punctuation
const QUOTES_AND_PAUSES_REGEX = /["'`“”‘’()\[\]{},-]/g;

// Matches negation tokens and optional modifier/filler adverbs in active clause
const CLAUSE_NEGATION_REGEX =
  /(?:^|\b)(?:not|never|no|non|hardly|scarcely|neither|without|ain't|isn't|aren't|wasn't|weren't|won't|don't|doesn't|didn't)\s+(?:(?:a|an|the|very|really|overly|strictly|considered|quite|entirely|in)\s+)*$/i;

// Hard clause terminators that break the lookback window
const CLAUSE_TERMINATORS_REGEX = /[\.\!\?;\n\r]+/;

/**
 * Normalizes an active clause fragment by:
 * 1. Removing balanced parentheticals and inner content
 * 2. Stripping quotes and pause punctuation
 * 3. Collapsing multiple whitespace intervals
 */
export function normalizeClause(rawClause: string): string {
  return rawClause
    .replace(BALANCED_PARENTHETICAL_REGEX, ' ')
    .replace(QUOTES_AND_PAUSES_REGEX, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Checks if a keyword occurs affirmatively in a text body.
 * - Rejects occurrences prefixed with 'non-' or preceded by negation adverbs in the SAME clause.
 * - Ensures sentence terminators (. ! ? ; \n) break the lookback window.
 * - Handles parenthetical asides and quote marks between negation and target.
 */
export function hasAffirmativeMatch(text: string, keyword: string): boolean {
  const pattern = new RegExp(`(\\b(?:non-?)?)(${keyword})\\b`, 'gi');
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    const prefixHyphen = match[1].toLowerCase();
    const matchIndex = match.index;

    // 1. Direct hyphenated negation check (e.g. "non-blocking", "non-critical")
    if (prefixHyphen.startsWith('non')) {
      continue;
    }

    // 2. Extract preceding window (up to 60 characters to allow for parentheticals)
    const windowStart = Math.max(0, matchIndex - 60);
    const rawPrecedingText = text.slice(windowStart, matchIndex);

    // 3. Clause Boundary Guard: isolate current clause fragment
    const clauseFragments = rawPrecedingText.split(CLAUSE_TERMINATORS_REGEX);
    const rawActiveClause = clauseFragments[clauseFragments.length - 1];

    // 4. Normalize: drop parenthetical asides, quotes, commas, and excess spaces
    const normalizedActiveClause = normalizeClause(rawActiveClause);

    // 5. Test if normalized clause concludes with a negation pattern
    if (CLAUSE_NEGATION_REGEX.test(normalizedActiveClause)) {
      continue; // Negated in active clause; proceed to subsequent occurrences
    }

    return true; // Found un-negated affirmative match
  }

  return false;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test modules/ticket-scorer/tests/negation.test.ts`
Expected: PASS with 5 passing tests

- [ ] **Step 5: Commit**

```bash
git add modules/ticket-scorer/src/negation-matcher.ts modules/ticket-scorer/tests/negation.test.ts
git commit -m "feat(ticket-scorer): add clause-bounded negation matcher and test suite"
```

---

### Task 3: Deterministic Ticket Scorer Engine and Rubric

**Files:**
- Create: `modules/ticket-scorer/src/scorer.ts`
- Create: `modules/ticket-scorer/tests/scorer.test.ts`

**Interfaces:**
- Consumes: `ScorerConfig`, `ScorerOptions`, `TicketScoreResult`, `DEFAULT_CONFIG` from `./types.js`, `hasAffirmativeMatch` from `./negation-matcher.js`
- Produces: `DeterministicTicketScorer` class with `score(rawMarkdown: string): TicketScoreResult`

- [ ] **Step 1: Write failing tests for DeterministicTicketScorer**

Create `modules/ticket-scorer/tests/scorer.test.ts`:
```typescript
import test from 'node:test';
import assert from 'node:assert/strict';
import { DeterministicTicketScorer } from '../src/scorer.js';

test('DeterministicTicketScorer scores complete sample ticket accurately (90 score -> P0)', () => {
  const scorer = new DeterministicTicketScorer();
  const sampleTicket = `
## Problem Description
Regression detected in engine sync pipeline. The ledger worker fails when processing concurrent deposits.

### Repro
\`\`\`bash
npm run test:repro -- --worker=sync
\`\`\`

### Acceptance Criteria
- [ ] Mutex locked on ledger access
- [ ] Regression test added for concurrent ingress
- [ ] Fix leak in event stream handler
`;

  const result = scorer.score(sampleTicket);

  assert.equal(result.totalScore, 90);
  assert.equal(result.tier, 'P0');
  assert.deepEqual(result.breakdown, {
    completeness: 35,
    urgency: 20,
    domainScope: 20,
    actionability: 15,
  });
  assert.ok(result.flags.includes('KEYWORD_REGRESSION'));
  assert.ok(result.flags.includes('KEYWORD_LEAK'));
  assert.ok(result.flags.includes('DOMAIN_ENGINE'));
  assert.ok(result.flags.includes('DOMAIN_SYNC'));
  assert.ok(result.flags.includes('DOMAIN_LEDGER'));
});

test('DeterministicTicketScorer handles empty or minimal tickets with low score and flags', () => {
  const scorer = new DeterministicTicketScorer();
  const result = scorer.score('');

  assert.equal(result.totalScore, 0);
  assert.equal(result.tier, 'P3');
  assert.deepEqual(result.breakdown, {
    completeness: 0,
    urgency: 0,
    domainScope: 0,
    actionability: 0,
  });
  assert.ok(result.flags.includes('LOW_WORD_COUNT'));
  assert.ok(result.flags.includes('MISSING_CHECKLIST_CRITERIA'));
  assert.ok(result.flags.includes('UNRECOGNIZED_DOMAIN'));
});

test('DeterministicTicketScorer applies P0 floor override on panic keyword even with low total score', () => {
  const scorer = new DeterministicTicketScorer();
  const ticket = 'System panic on startup.';
  const result = scorer.score(ticket);

  assert.ok(result.totalScore < 80);
  assert.equal(result.tier, 'P0'); // Floor override applied
  assert.ok(result.flags.includes('KEYWORD_PANIC'));
});

test('DeterministicTicketScorer respects custom constructor options', () => {
  const customScorer = new DeterministicTicketScorer({
    knownDomains: ['billing', 'payments'],
    urgencyKeywords: { outage: 30 },
    overrideP0Keywords: ['outage'],
    minBodyWordCount: 5,
    scoreThresholds: { p0: 95 },
  });

  const ticket = 'Major outage in payments subsystem.';
  const result = customScorer.score(ticket);

  assert.ok(result.flags.includes('DOMAIN_PAYMENTS'));
  assert.ok(result.flags.includes('KEYWORD_OUTAGE'));
  assert.equal(result.tier, 'P0');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test modules/ticket-scorer/tests/scorer.test.ts`
Expected: FAIL with "Cannot find module '../src/scorer.js'"

- [ ] **Step 3: Implement `src/scorer.ts`**

Create `modules/ticket-scorer/src/scorer.ts`:
```typescript
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import { visit } from 'unist-util-visit';
import type { Node, Parent } from 'unist';
import {
  DEFAULT_CONFIG,
  type PriorityTier,
  type ScoreBreakdown,
  type ScorerConfig,
  type ScorerOptions,
  type TicketScoreResult,
} from './types.js';
import { hasAffirmativeMatch } from './negation-matcher.js';

interface ListItemNode extends Parent {
  type: 'listItem';
  checked?: boolean | null;
}

interface TextNode extends Node {
  type: 'text';
  value: string;
}

export class DeterministicTicketScorer {
  private config: ScorerConfig;
  private processor = unified().use(remarkParse);

  constructor(options?: ScorerOptions) {
    this.config = {
      knownDomains: options?.knownDomains ?? DEFAULT_CONFIG.knownDomains,
      urgencyKeywords: options?.urgencyKeywords ?? DEFAULT_CONFIG.urgencyKeywords,
      minBodyWordCount: options?.minBodyWordCount ?? DEFAULT_CONFIG.minBodyWordCount,
      overrideP0Keywords: options?.overrideP0Keywords ?? DEFAULT_CONFIG.overrideP0Keywords,
      scoreThresholds: {
        p0: options?.scoreThresholds?.p0 ?? DEFAULT_CONFIG.scoreThresholds.p0,
        p1: options?.scoreThresholds?.p1 ?? DEFAULT_CONFIG.scoreThresholds.p1,
        p2: options?.scoreThresholds?.p2 ?? DEFAULT_CONFIG.scoreThresholds.p2,
      },
    };
  }

  public score(rawMarkdown: string): TicketScoreResult {
    const flags: string[] = [];
    const tree = this.processor.parse(rawMarkdown);

    let totalHeadings = 0;
    let totalChecklists = 0;
    let checkedItems = 0;
    let codeBlockCount = 0;
    let inlineCodeCount = 0;
    let textContent = '';

    visit(tree, (node: Node) => {
      if (node.type === 'heading') {
        totalHeadings++;
      } else if (node.type === 'listItem') {
        const item = node as ListItemNode;
        if (typeof item.checked === 'boolean') {
          totalChecklists++;
          if (item.checked) checkedItems++;
        }
      } else if (node.type === 'code') {
        codeBlockCount++;
      } else if (node.type === 'inlineCode') {
        inlineCodeCount++;
      } else if (node.type === 'text') {
        textContent += ' ' + (node as TextNode).value;
      }
    });

    const normalizedText = textContent.toLowerCase();
    const words = normalizedText.trim().split(/\s+/).filter(Boolean);
    const wordCount = words.length;

    // 1. Completeness Evaluation (Max 35)
    let completeness = 0;
    if (wordCount >= this.config.minBodyWordCount) {
      completeness += 10;
    } else {
      flags.push('LOW_WORD_COUNT');
    }

    if (totalHeadings >= 2) {
      completeness += 10;
    } else if (totalHeadings === 1) {
      completeness += 5;
    }

    if (codeBlockCount > 0) {
      completeness += 15;
    } else if (inlineCodeCount > 0) {
      completeness += 8;
    }
    completeness = Math.min(35, completeness);

    // 2. Actionability Evaluation (Max 15)
    let actionability = 0;
    if (totalChecklists > 0) {
      actionability += 10;
      if (totalChecklists >= 3) {
        actionability += 5;
      }
    } else {
      flags.push('MISSING_CHECKLIST_CRITERIA');
    }
    actionability = Math.min(15, actionability);

    // 3. Urgency Indicators (Max 30)
    let urgency = 0;
    for (const [kw, weight] of Object.entries(this.config.urgencyKeywords)) {
      if (hasAffirmativeMatch(normalizedText, kw)) {
        urgency += weight;
        flags.push(`KEYWORD_${kw.toUpperCase()}`);
      }
    }
    urgency = Math.min(30, urgency);

    // 4. Domain Relevance (Max 20)
    let domainScore = 0;
    let matchedDomains = 0;
    for (const domain of this.config.knownDomains) {
      const regex = new RegExp(`\\b${domain}\\b`, 'i');
      if (regex.test(normalizedText)) {
        domainScore += 10;
        matchedDomains++;
        flags.push(`DOMAIN_${domain.toUpperCase()}`);
      }
    }
    if (matchedDomains === 0) {
      flags.push('UNRECOGNIZED_DOMAIN');
    }
    domainScore = Math.min(20, domainScore);

    const totalScore = completeness + actionability + urgency + domainScore;
    const tier = this.resolveTier(totalScore, flags);

    return {
      totalScore,
      tier,
      breakdown: {
        completeness,
        urgency,
        domainScope: domainScore,
        actionability,
      },
      flags,
    };
  }

  private resolveTier(score: number, flags: string[]): PriorityTier {
    // Explicit override: Check if any normalized override keyword is present in flags
    for (const kw of this.config.overrideP0Keywords) {
      if (flags.includes(`KEYWORD_${kw.toUpperCase()}`)) {
        return 'P0';
      }
    }

    if (score >= this.config.scoreThresholds.p0) return 'P0';
    if (score >= this.config.scoreThresholds.p1) return 'P1';
    if (score >= this.config.scoreThresholds.p2) return 'P2';
    return 'P3';
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test modules/ticket-scorer/tests/scorer.test.ts`
Expected: PASS with 4 passing tests

- [ ] **Step 5: Commit**

```bash
git add modules/ticket-scorer/src/scorer.ts modules/ticket-scorer/tests/scorer.test.ts
git commit -m "feat(ticket-scorer): implement DeterministicTicketScorer engine and rubric"
```

---

### Task 4: Public Entrypoint and Full Build & Test Verification

**Files:**
- Create: `modules/ticket-scorer/src/index.ts`
- Modify: `modules/ticket-scorer/package.json`

**Interfaces:**
- Consumes: `src/scorer.ts`, `src/negation-matcher.ts`, `src/types.ts`
- Produces: Public module exports for `@toolforge/ticket-scorer`

- [ ] **Step 1: Implement `src/index.ts`**

Create `modules/ticket-scorer/src/index.ts`:
```typescript
export { DeterministicTicketScorer } from './scorer.js';
export { hasAffirmativeMatch, normalizeClause } from './negation-matcher.js';
export {
  DEFAULT_CONFIG,
  type PriorityTier,
  type ScoreBreakdown,
  type ScorerConfig,
  type ScorerOptions,
  type TicketScoreResult,
} from './types.js';
```

- [ ] **Step 2: Run all test suites across the module**

Run: `npx tsx --test modules/ticket-scorer/tests/**/*.test.ts`
Expected: PASS across all 3 test files (`types.test.ts`, `negation.test.ts`, `scorer.test.ts`) with 0 failures

- [ ] **Step 3: Compile TypeScript definitions and verify build**

Run: `npx tsc --project modules/ticket-scorer/tsconfig.json`
Expected: Clean compilation into `modules/ticket-scorer/dist/` with `.d.ts` and `.js` files generated

- [ ] **Step 4: Commit**

```bash
git add modules/ticket-scorer/src/index.ts
git commit -m "feat(ticket-scorer): add public entrypoint and verify full test suite"
```
