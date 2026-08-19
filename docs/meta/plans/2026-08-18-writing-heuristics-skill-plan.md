# Toolforge Writing Heuristics and Global Style Enforcement Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build, test, and activate a deterministic, AST-aware technical writing heuristics skill, zero-dependency standalone CLI linter/fixer, and cross-platform instruction-surface distribution for all LLMs.

**Architecture:** A canonical `heuristics.json` acts as the sole source of truth, compiled deterministically into `SKILL.md` and `docs/rules.md`. An AST-aware linter (`unified` + `remark-gfm`) evaluates prose while exempting code and tables, an atomic file-replacement engine applies safe autofixes with backup rollback, and a PowerShell junction script safely distributes the skill across Gemini, Claude, OpenCode, and Copilot.

**Tech Stack:** TypeScript, Node.js (CommonJS bundled runtime), `unified`, `remark-parse`, `remark-gfm`, `remark-frontmatter`, `tsup`, `vitest`, PowerShell 7+.

## Global Constraints
- Canonical Spec: `docs/meta/specs/2026-08-18-writing-heuristics-skill-design.md`
- Explicit Rule Inventory: Exactly 9 canonical rules (`ban-throat-clearing`, `ban-filler-adverbs`, `avoid-first-person-plural`, `use-second-person`, `active-voice`, `condition-before-action`, `heading-sentence-case`, `descriptive-links`, `serial-comma`).
- Zero Rule Drift: `heuristics.json` is the sole source of truth; `SKILL.md` and `docs/rules.md` are compiled artifacts verified in CI.
- Data Safety: No blind deletes in sync scripts; only verified junctions pointing to source may be manipulated.
- Safe Autofix: Only rules with Confidence >= 0.95 (`ban-throat-clearing` and `heading-sentence-case`) may be auto-mutated; all sub-threshold rules are advisory only.
- Strict Stream Separation: When reading from stdin, diagnostic logs go strictly to `stderr` and transformed prose goes to `stdout`.
- Two-Gate Execution: Phase 1 builds and validates the local engine completely; Phase 2 (global distribution and manifest update) requires an explicit user approval checkpoint.

---

## File Structure

```
skills/writing-heuristics/
|-- skill.json                 # Toolforge capability contract and router intent
|-- heuristics.json            # Canonical rule catalog (9 rules - source of truth)
|-- package.json               # Package definition and test/build scripts
|-- tsconfig.json              # TypeScript build configuration
|-- SKILL.md                   # Compiled LLM prompt instructions
|-- src/
|   |-- types.ts               # Shared interfaces (Rule, Violation, ASTNode, Config)
|   |-- compiler.ts           # Compiles heuristics.json -> SKILL.md and docs/rules.md
|   |-- parser.ts             # Remark AST parser with code/table/frontmatter exemptions
|   |-- suppressions.ts       # HTML comment directive lexer (author, reason, expiry)
|   |-- linter.ts              # Core rule evaluation engine (9 canonical rules)
|   |-- fixer.ts               # Atomic file replacement, EOL/BOM preservation, safe fix
|   |-- formatters.ts         # Output formatters: stylish, json, sarif
|   |-- cli.ts                 # CLI entrypoint and stream separation
|   `-- index.ts               # Programmatic API for ./run-tool.ps1
|-- bin/
|   |-- compile.js             # Compilation runner script
|   |-- lint-heuristics.js     # Bundled standalone executable CLI (zero external deps)
|   `-- sync-global.ps1        # Safe PowerShell junction manager and rollback engine
|-- tests/
|   |-- fixtures/              # Dedicated markdown test files (positive/negative/suppressed)
|   |-- codegen.test.ts        # Zero-drift compiler test
|   |-- parser.test.ts         # AST exemption and directive lexer tests
|   |-- linter.test.ts         # 9-rule verification test suite
|   |-- fixer.test.ts          # Atomic replacement, EOL/BOM, and backup tests
|   |-- cli.test.ts            # Exit codes, formats, stdin/stderr stream tests
|   `-- sync-script.test.ts    # Junction verification, target protection, rollback tests
|-- docs/
|   |-- index.md               # User and Operator Guide
|   `-- rules.md               # Compiled human rule reference manual
`-- README.md                  # Quick reference card
```

---

## Phase 1: Local Package & Core Engine (Zero Global Mutation)

### Task 1: Package Scaffold, Type Definitions, and Canonical 9-Rule `heuristics.json`

**Files:**
- Create: `skills/writing-heuristics/package.json`
- Create: `skills/writing-heuristics/tsconfig.json`
- Create: `skills/writing-heuristics/src/types.ts`
- Create: `skills/writing-heuristics/heuristics.json`
- Create: `skills/writing-heuristics/skill.json`

**Interfaces:**
- Produces: `RuleDefinition`, `HeuristicsCatalog`, `Violation`, `LintResult`, `SuppressionDirective` types in `src/types.ts`.
- Produces: `heuristics.json` containing the 9 canonical rules:
  1. `ban-throat-clearing` (severity: error, autofix: true, confidence: 1.0)
  2. `ban-filler-adverbs` (severity: warning, autofix: false, confidence: 0.85)
  3. `avoid-first-person-plural` (severity: warning, autofix: false, confidence: 0.90)
  4. `use-second-person` (severity: warning, autofix: false, confidence: 0.80)
  5. `active-voice` (severity: warning, autofix: false, confidence: 0.80)
  6. `condition-before-action` (severity: warning, autofix: false, confidence: 0.75)
  7. `heading-sentence-case` (severity: error, autofix: true, confidence: 0.95)
  8. `descriptive-links` (severity: error, autofix: false, confidence: 1.0)
  9. `serial-comma` (severity: warning, autofix: false, confidence: 0.85)
- Produces: `skill.json` with provisional metadata (`registered: false`, `syncable: false`, router intent).

- [ ] **Step 1: Write `package.json` with scripts (`build`, `test`, `compile`) and dependencies (`unified`, `remark-parse`, `remark-gfm`, `remark-frontmatter`, `tsup`, `vitest`)**
- [ ] **Step 2: Write `tsconfig.json` configured for Node ES/CommonJS**
- [ ] **Step 3: Define TypeScript interfaces in `src/types.ts`**
- [ ] **Step 4: Author the canonical `heuristics.json` with all 9 rules**
- [ ] **Step 5: Create provisional `skill.json` matching Toolforge contract**
- [ ] **Step 6: Install dependencies and verify JSON validity using `node -e "JSON.parse(fs.readFileSync('heuristics.json'))"`**
- [ ] **Step 7: Commit Task 1 changes**

```bash
git add skills/writing-heuristics/
git commit -m "feat(writing-heuristics): scaffold package, types, and canonical 9-rule heuristics.json"
```

---

### Task 2: Deterministic Markdown Compiler & Zero-Drift Codegen Test

**Files:**
- Create: `skills/writing-heuristics/src/compiler.ts`
- Create: `skills/writing-heuristics/bin/compile.js`
- Create: `skills/writing-heuristics/tests/codegen.test.ts`
- Output: `skills/writing-heuristics/SKILL.md`
- Output: `skills/writing-heuristics/docs/rules.md`

**Interfaces:**
- Consumes: `heuristics.json`, `src/types.ts`
- Produces: `compileCatalog(catalogPath: string): { skillMd: string, rulesMd: string }`

- [ ] **Step 1: Write failing codegen test in `tests/codegen.test.ts` that asserts `SKILL.md` and `docs/rules.md` match `compileCatalog()` output**
- [ ] **Step 2: Implement compiler in `src/compiler.ts` converting 9 rules to LLM prompt format (`SKILL.md`) and human reference (`docs/rules.md`)**
- [ ] **Step 3: Implement executable runner in `bin/compile.js`**
- [ ] **Step 4: Run `node bin/compile.js` to generate `SKILL.md` and `docs/rules.md`**
- [ ] **Step 5: Run `npx vitest run tests/codegen.test.ts` and verify test passes**
- [ ] **Step 6: Commit Task 2 changes**

```bash
git add skills/writing-heuristics/
git commit -m "feat(writing-heuristics): implement deterministic markdown compiler and zero-drift test"
```

---

### Task 3: AST Markdown Parser & Directive Suppression Lexer

**Files:**
- Create: `skills/writing-heuristics/src/parser.ts`
- Create: `skills/writing-heuristics/src/suppressions.ts`
- Create: `skills/writing-heuristics/tests/parser.test.ts`

**Interfaces:**
- Consumes: `unified`, `remark-parse`, `remark-gfm`, `remark-frontmatter`
- Produces: `parseMarkdown(content: string): MarkdownAST` (with `table`, `code`, `inlineCode`, `html`, `yaml` tags)
- Produces: `extractSuppressions(ast: MarkdownAST): SuppressionRegistry` (validating `author`, `reason`, and ISO `until` dates)

- [ ] **Step 1: Write failing tests in `tests/parser.test.ts` asserting:**
  - GFM tables, code blocks, and frontmatter nodes are parsed and marked as prose-exempt.
  - Links are parsed with child text and URL metadata.
  - HTML comments are parsed for `author`, `reason`, and `until` attributes.
  - Expired `until` dates produce invalid suppression status.
- [ ] **Step 2: Implement AST parser with AST visitor in `src/parser.ts`**
- [ ] **Step 3: Implement directive suppression lexer in `src/suppressions.ts`**
- [ ] **Step 4: Run `npx vitest run tests/parser.test.ts` and verify 100% pass**
- [ ] **Step 5: Commit Task 3 changes**

```bash
git add skills/writing-heuristics/
git commit -m "feat(writing-heuristics): implement AST parser and directive suppression lexer"
```

---

### Task 4: Core Rule Evaluation Engine (9 Canonical Rules)

**Files:**
- Create: `skills/writing-heuristics/src/linter.ts`
- Create: `skills/writing-heuristics/tests/linter.test.ts`
- Create: `skills/writing-heuristics/tests/fixtures/pass-all.md`
- Create: `skills/writing-heuristics/tests/fixtures/fail-rules.md`
- Create: `skills/writing-heuristics/tests/fixtures/suppressed.md`

**Interfaces:**
- Consumes: `src/parser.ts`, `src/suppressions.ts`, `heuristics.json`
- Produces: `lintText(content: string, options?: LintOptions): LintResult`
- Produces: `lintFile(filePath: string, options?: LintOptions): Promise<LintResult>`

- [ ] **Step 1: Author markdown test fixtures (`pass-all.md`, `fail-rules.md`, `suppressed.md`) covering all 9 rules**
- [ ] **Step 2: Write failing unit test suite in `tests/linter.test.ts` testing each of the 9 rules independently**
- [ ] **Step 3: Implement rule evaluators in `src/linter.ts` for all 9 rules**
- [ ] **Step 4: Integrate suppression registry filtering and expired suppression error generation into `src/linter.ts`**
- [ ] **Step 5: Run `npx vitest run tests/linter.test.ts` and verify 100% pass**
- [ ] **Step 6: Commit Task 4 changes**

```bash
git add skills/writing-heuristics/
git commit -m "feat(writing-heuristics): implement core prose linter and 9-rule evaluation suite"
```

---

### Task 5: Safe Autofix Engine & Atomic File Replacement

**Files:**
- Create: `skills/writing-heuristics/src/fixer.ts`
- Create: `skills/writing-heuristics/tests/fixer.test.ts`

**Interfaces:**
- Consumes: `src/linter.ts`, `src/types.ts`
- Produces: `applyFixes(content: string, violations: Violation[]): { fixedContent: string, appliedCount: number }`
- Produces: `safeFixFile(filePath: string, options: FixOptions): Promise<FixFileResult>`

- [ ] **Step 1: Write failing tests in `tests/fixer.test.ts` asserting:**
  - Confidence >= 0.95 gate: `ban-throat-clearing` and `heading-sentence-case` are autofixed; all other rules are skipped.
  - CRLF vs LF line ending preservation.
  - UTF-8 BOM preservation.
  - Collision-resistant backup creation (`<file>.<timestamp>.bak`).
  - Atomic replacement sequence and temp cleanup.
- [ ] **Step 2: Implement AST string transform engine in `src/fixer.ts`**
- [ ] **Step 3: Implement atomic replacement sequence and crash recovery in `src/fixer.ts`**
- [ ] **Step 4: Run `npx vitest run tests/fixer.test.ts` and verify passing test suite**
- [ ] **Step 5: Commit Task 5 changes**

```bash
git add skills/writing-heuristics/
git commit -m "feat(writing-heuristics): implement safe autofix engine and atomic file replacement"
```

---

### Task 6: CLI Runner, Bundler (`tsup`), & Clean-Consumer Verification

**Files:**
- Create: `skills/writing-heuristics/src/formatters.ts`
- Create: `skills/writing-heuristics/src/cli.ts`
- Create: `skills/writing-heuristics/src/index.ts`
- Create: `skills/writing-heuristics/tests/cli.test.ts`
- Output: `skills/writing-heuristics/bin/lint-heuristics.js`

**Interfaces:**
- Produces: Standalone, zero-external-dependency executable CLI at `bin/lint-heuristics.js` (bundled with `tsup`).
- Produces: Output formats `stylish`, `json`, `sarif`.
- Guarantees: Stream separation (diagnostics to `stderr` on stdin; transformed prose to `stdout`).

- [ ] **Step 1: Implement formatters (`stylish`, `json`, `sarif`) in `src/formatters.ts`**
- [ ] **Step 2: Implement CLI argument parser and stream separation in `src/cli.ts`**
- [ ] **Step 3: Implement programmatic entrypoint in `src/index.ts` for `./run-tool.ps1`**
- [ ] **Step 4: Configure `tsup` in `package.json` and build standalone bundle `bin/lint-heuristics.js`**
- [ ] **Step 5: Write CLI end-to-end tests in `tests/cli.test.ts` (testing exit codes 0, 1, 2, stdin, `--dry-run`, and format options)**
- [ ] **Step 6: Clean-Consumer Verification: Execute `node bin/lint-heuristics.js --help` from an isolated temp directory to verify zero external runtime dependency requirement**
- [ ] **Step 7: Run `npm test` inside `skills/writing-heuristics` to verify 100% passing test suites**
- [ ] **Step 8: Commit Phase 1 changes**

```bash
git add skills/writing-heuristics/
git commit -m "feat(writing-heuristics): complete CLI runner, formatters, and standalone build"
```

---

## === EXPLICIT APPROVAL CHECKPOINT (GATE 1) ===
> **STOP AND VERIFY:** Phase 1 complete. All unit tests, parser tests, fixer tests, codegen tests, and clean-consumer CLI tests must pass locally with 100% success.
> **DO NOT PROCEED TO PHASE 2** (no global junctions, no `AGENTS.md` mutation, no `manifest.json` registration) until user explicitly reviews Phase 1 deliverables and provides approval.

---

## Phase 2: Global Distribution & Activation Gate

### Task 7: Safe PowerShell Junction Management Script & Safety Tests

**Files:**
- Create: `skills/writing-heuristics/bin/sync-global.ps1`
- Create: `skills/writing-heuristics/tests/sync-script.test.ts`

**Interfaces:**
- Produces: Safe junction manager with `-Verify` and `-Uninstall` switches.
- Guarantees: Rejects unmanaged target paths, validates source identity, and cleans only verified junctions.

- [ ] **Step 1: Author `bin/sync-global.ps1` with dynamic source resolution, `Test-IsManagedJunction`, and pre-flight target inspection**
- [ ] **Step 2: Write comprehensive test in `tests/sync-script.test.ts` testing:**
  - Missing source -> fails pre-flight.
  - Existing unmanaged real directory -> aborts without deletion.
  - Existing file -> aborts.
  - Broken junction -> safely cleaned.
  - Valid managed junction -> verified and removed cleanly on `-Uninstall`.
- [ ] **Step 3: Run `npx vitest run tests/sync-script.test.ts` and verify test suite passes**
- [ ] **Step 4: Commit Task 7 changes**

```bash
git add skills/writing-heuristics/
git commit -m "feat(writing-heuristics): add safe PowerShell junction sync and rollback script with tests"
```

---

### Task 8: Instruction-Surface Integration (`AGENTS.md` & Copilot)

**Files:**
- Modify: `AGENTS.md:85-86`
- Modify: `.github/copilot-instructions.md`

- [ ] **Step 1: Inject managed `TOOLFORGE-WRITING-DISCIPLINE` sub-region into `AGENTS.md` strictly within lines 85–86 (`<!-- IJFW-DISCIPLINE-START -->` and `<!-- IJFW-DISCIPLINE-END -->`)**
- [ ] **Step 2: Inject managed writing discipline block into `.github/copilot-instructions.md`**
- [ ] **Step 3: Verify surrounding IJFW regions in `AGENTS.md` remain completely untouched**
- [ ] **Step 4: Commit Task 8 changes**

```bash
git add AGENTS.md .github/copilot-instructions.md
git commit -m "docs(governance): inject managed writing discipline into AGENTS.md and copilot instructions"
```

---

### Task 9: 4-Stage Manifest Activation & End-to-End Verification

**Files:**
- Modify: `manifest.json`
- Modify: `skills/writing-heuristics/skill.json`
- Modify: `skills/SKILLPACK-VALIDATION.md`

- [ ] **Step 1: Stage 1 (Registration): Idempotently insert skill entry into `manifest.json` with `status: "development"`, `runtime: "untested"`, `distributed: false`, `overall: "pending"`**
- [ ] **Step 2: Stage 2 (Runtime Gate): Run `npm test` inside `skills/writing-heuristics` (all tests passing -> transition `runtime: "healthy"` )**
- [ ] **Step 3: Stage 3 (Distribution Gate): Execute `pwsh bin/sync-global.ps1` and run `pwsh bin/sync-global.ps1 -Verify` (all junctions verified -> transition `distributed: true`)**
- [ ] **Step 4: Stage 4 (Final Activation): Transition `status: "active"` and `overall: "good"` in `manifest.json`, and update `skill.json` (`registered: true`, `syncable: true`)**
- [ ] **Step 5: Update `skills/SKILLPACK-VALIDATION.md` metadata**
- [ ] **Step 6: Dogfooding Check: Run `node skills/writing-heuristics/bin/lint-heuristics.js check docs/` across workspace**
- [ ] **Step 7: Commit Task 9 changes**

```bash
git add manifest.json skills/writing-heuristics/ skills/SKILLPACK-VALIDATION.md
git commit -m "feat(writing-heuristics): complete 4-stage activation gate, global sync, and manifest registration"
```
