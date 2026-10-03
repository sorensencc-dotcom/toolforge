# Deterministic Ticket Scorer Design Specification

## 1. Overview
The **Deterministic Ticket Scorer** is a self-contained, zero-network, local TypeScript/Node.js module designed to score and classify incoming markdown cards/tickets in an ingress pipeline. It deterministically computes structural completeness, actionability, urgency signals, and domain relevance on a 0–100 integer scale, mapping results into discrete priority tiers (`P0` through `P3`).

---

## 2. Directory Structure & Layout
The module lives at `modules/ticket-scorer/`:

```
modules/ticket-scorer/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts               # Public exports
│   ├── scorer.ts              # DeterministicTicketScorer engine
│   ├── negation-matcher.ts    # Clause-bounded affirmative matcher
│   └── types.ts               # Interfaces, options, and types
└── tests/
    ├── scorer.test.ts         # Full AST scoring & tier mapping tests (node:test)
    └── negation.test.ts       # Negation & boundary isolation edge cases (node:test)
```

---

## 3. Data Types & Interfaces

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
    p0: number; // default: 80
    p1: number; // default: 60
    p2: number; // default: 35
  };
}

export type ScorerOptions = Partial<Omit<ScorerConfig, 'scoreThresholds'>> & {
  scoreThresholds?: Partial<ScorerConfig['scoreThresholds']>;
};
```

---

## 4. Scoring Heuristics & Rubric

### 4.1 Completeness (Max: 35)
* **Body Word Count**: $\ge \text{minBodyWordCount}$ (20 words) $\implies +10$. (Below threshold adds `LOW_WORD_COUNT` flag).
* **Headings**:
  * $\ge 2$ headings $\implies +10$
  * $1$ heading $\implies +5$
* **Code Fences / Spans**:
  * Code blocks ($> 0$) $\implies +15$
  * Inline code ($> 0$, no code block) $\implies +8$
* **Score Cap**: Value capped at `Math.min(35, completeness)`.

### 4.2 Actionability (Max: 15)
* **Checklists**:
  * Any checklist items ($> 0$) $\implies +10$. (Zero checklists adds `MISSING_CHECKLIST_CRITERIA` flag).
  * High density ($\ge 3$ checklists) $\implies +5$.

### 4.3 Urgency Indicators (Max: 30)
* Scans `urgencyKeywords` using `hasAffirmativeMatch()`.
* Default weights:
  * `corrupt`: 15, `panic`: 15
  * `critical`: 12, `blocker`: 12
  * `blocking`: 10, `regression`: 10, `leak`: 10
  * `urgent`: 8, `asap`: 6, `fixme`: 4
* Adds `KEYWORD_<NAME>` to `flags`.

### 4.4 Domain Relevance (Max: 20)
* Matches `knownDomains` (default: `core`, `engine`, `governance`, `sync`, `ledger`, `ast`, `cli`, `auth`).
* $+10$ per matched domain up to 20 max. Adds `DOMAIN_<NAME>` to `flags`.
* Zero domain matches adds `UNRECOGNIZED_DOMAIN` to `flags`.

---

## 5. Negation Matching & Boundary Preservation

### 5.1 Clause Isolation
* **Sentence Terminators**: `[\.\!\?;\n\r]+`
* Window size: Up to 60 characters preceding the keyword match.
* Terminators isolate the active clause so prior sentences do not leak negation (e.g. `"Did not run. Critical bug."` $\implies \text{true}$).

### 5.2 Clause Sanitization
* Strips balanced parentheticals: `/\([^)]*\)|\[[^\]]*\]|\{[^}]*\}/g`
* Strips residual quotes and punctuation: `/['"`“'‘’()\[\]{},-]/g`
* Collapses whitespace before evaluating `CLAUSE_NEGATION_REGEX`.

---

## 6. Priority Tier Resolution & Overrides

1. **Numerical Bounds**:
   * $\ge 80 \implies \mathbf{P0}$
   * $\ge 60 \implies \mathbf{P1}$
   * $\ge 35 \implies \mathbf{P2}$
   * $< 35 \implies \mathbf{P3}$
2. **P0 Floor Override**:
   * If any keyword in `overrideP0Keywords` (normalized as `KEYWORD_<NAME>`) is present in `flags`, tier resolves to `P0` unconditionally regardless of total score.

---

## 7. Testing Strategy
* Native Node.js test runner (`node --test`).
* Complete unit test coverage across:
  * Negation edge cases (hyphenated, adverbs, clauses, parentheticals, quotes).
  * Rubric completeness and dimension caps.
  * Structural variations (empty markdown, single sentence, partial checklists).
  * Custom configuration overrides.
