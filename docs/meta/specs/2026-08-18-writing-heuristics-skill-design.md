# Toolforge Writing Heuristics and Style Enforcement Engine

**Document Status:** Spec Review (Pre-Implementation Design — Revision 5)
**Author:** soren
**Date:** 2026-08-18
**Governance Scope:** Toolforge Skills Ecosystem, Universal Agent Discipline, Cross-Platform LLM Instruction Surfaces
**Canonical Spec Path:** `docs/meta/specs/2026-08-18-writing-heuristics-skill-design.md`

---

## 1. Overview and Problem Statement

Large Language Models (Gemini, Claude, Copilot, Codex, etc.) exhibit systematic conversational drift when producing technical documentation, architecture specifications, and code reviews:
- **Conversational Slop**: Throat-clearing pre-announcements (*"Sure! In this section we will delve..."*).
- **First-Person Plural & Passive Voice**: Obscures ownership (*"We recommend that the service is started by..."* instead of *"Start the service..."*).
- **Inverted Instruction Sequencing**: Stating directives before prerequisites (*"Run X to achieve Y"*).
- **Structural Inconsistency**: Title-cased headings, ambiguous link text (*"click here"*), and arbitrary numbered lists for static enumerations.

This system provides a two-tier solution:
1. **Tier 1 (Instruction-Surface Distribution)**: Distributes managed, version-controlled writing discipline blocks to platform instruction files (`AGENTS.md`, `.github/copilot-instructions.md`, etc.) to shape baseline model generation.
2. **Tier 2 (Toolforge Prose Linter and Safe Fixer)**: A standalone, AST-aware markdown linter, safe auto-fix transformer, and on-demand skill package rooted in canonical technical writing standards.

---

## 2. Rule Provenance, Sources, and Licensing

The writing rules in this package synthesize standards from multiple sources with clear attribution and licensing:

| Domain | Rule ID | Severity | Source / Standard | License / Attribution |
|---|---|---|---|---|
| **Google Style** | `heading-sentence-case`, `descriptive-links`, `avoid-first-person-plural`, `use-second-person`, `active-voice`, `condition-before-action`, `serial-comma`, `ordered-sequences` | `error` / `warning` | [Google Developer Style Guide](https://developers.google.com/style) | CC BY 4.0 |
| **Anti-Slop** | `ban-throat-clearing`, `ban-filler-adverbs`, `assertion-density` | `error` / `warning` | [Nate B. Jones Analytical Writing Heuristics](https://x.com/natebjones/status/2089457435459404093) | Original prompt scaffold implementation inspired by public methodology |
| **Governance** | `suppression-governance`, `safe-fix-contract`, `codegen-invariant` | `error` | Toolforge Skills Framework Specification | MIT License |

### Modification and RFC Policy
Any modification, addition, or retirement of a heuristic rule requires:
1. An update to the canonical `heuristics.json` definition file.
2. Accompanying positive and negative test fixtures in `tests/fixtures/`.
3. Execution of `node bin/compile.js` to synchronize all derived prompt scaffolds and documentation.

---

## 3. Architecture and Source-of-Truth Invariant

```
                               +-----------------------------+
                               |       heuristics.json       |
                               |  (Canonical Source of Truth)|
                               +--------------+--------------+
                                              |
                              node bin/compile.js (Deterministic)
                                              |
                      +-----------------------+-----------------------+
                      |                                               |
                      v                                               v
               +--------------+                               +--------------+
               |   SKILL.md   |                               | docs/rules.md|
               | (LLM Prompt) |                               |(Human Manual)|
               +--------------+                               +--------------+
```

### Invariant: Zero Rule Drift
- `heuristics.json` is the sole authoritative definition for all rule IDs, severity levels, parser logic, regex tokens, explanations, and autofix transforms.
- `SKILL.md` and `docs/rules.md` are **compiled artifacts** generated deterministically by `node bin/compile.js`.
- `tests/codegen.test.ts` asserts in CI that both `SKILL.md` and `docs/rules.md` are byte-identical to compiler output.

---

## 4. Rule Specifications and AST Parser Scope Contract

### AST Parser Stack & Boundary Rules
The lint engine converts Markdown documents into an Abstract Syntax Tree (AST) using `unified` with `remark-parse`, `remark-gfm` (for GitHub Flavored Markdown tables and task lists), and `remark-frontmatter` (for YAML/TOML frontmatter parsing).

- **Parsed Prose Nodes**: `paragraph`, `heading`, `list`, `listItem`, `blockquote`.
- **Parsed Metadata Nodes**:
  - `link` nodes: Inspected for anchor text (`link.children`) and destination URL for `descriptive-links`.
  - `html` comment nodes: Parsed exclusively by the Directive Lexer for suppression commands (`<!-- heuristics-disable ... -->`).
- **Exempt Nodes (Strictly Ignored for Prose Linting)**:
  - `code` (fenced code blocks)
  - `inlineCode` (inline code spans like variable names)
  - `table`, `tableRow`, `tableCell` (parsed as AST structures by `remark-gfm` but bypassed by prose rules)
  - General HTML markup/tags (non-comment HTML)
  - Frontmatter blocks (YAML/TOML headers)

### Canonical Heuristics Catalog (Complete 11-Rule Specification)

#### 1. `ban-throat-clearing`
- **Severity**: `error`
- **Autofix**: Yes (Confidence 1.0). Strips leading conversational opener clause.
- **Scope**: Beginning of prose paragraphs.
- **Pattern**: `^(Certainly|Sure thing|Sure|Here is|In this section|Let's dive|Note that|Allow me to)\b`
- **Pass Example**: *"To configure the client, supply your API key in the environment."*
- **Fail Example**: *"Certainly! In this section, we will delve into configuring the client."*

#### 2. `ban-filler-adverbs`
- **Severity**: `warning`
- **Autofix**: No (Confidence 0.85).
- **Target Terms**: `essentially`, `basically`, `crucial`, `game-changing`, `delve`, `comprehensive`, `seamlessly`.
- **Pass Example**: *"This update reduces memory overhead by 40%."*
- **Fail Example**: *"This game-changing update seamlessly and essentially eliminates overhead."*

#### 3. `avoid-first-person-plural`
- **Severity**: `warning`
- **Autofix**: No (Confidence 0.90).
- **Logic**: Flags first-person plural (*"we recommend"*, *"let's"*, *"in our opinion"*) in technical instructions.
- **Pass Example**: *"Install dependencies before starting the service."*
- **Fail Example**: *"We recommend that you install dependencies first."*

#### 4. `use-second-person`
- **Severity**: `warning` (Advisory Only — non-blocking in CI).
- **Autofix**: No (Confidence 0.80).
- **Logic**: Encourages direct second-person address (*"you"*) or imperative mood for instructions; flags third-person passive abstraction (*"the user must..."*).
- **Exemptions**: System architecture descriptions (*"The worker daemon polls..."*), third-person role definitions (*"Administrators manage permissions..."*), and quoted API contracts.
- **Pass Example**: *"You can configure the timeout in `config.json`."*
- **Fail Example**: *"The developer should configure the timeout in `config.json`."*

#### 5. `active-voice`
- **Severity**: `warning`
- **Autofix**: No (Confidence 0.80).
- **Logic**: Flags passive voice constructs (auxiliary verb + past participle + optional *"by"* agent) in instruction sentences.
- **Pass Example**: *"The scheduler triggers the backup job nightly."*
- **Fail Example**: *"The backup job is triggered nightly by the scheduler."*

#### 6. `assertion-density`
- **Severity**: `warning`
- **Autofix**: No (Confidence 0.80).
- **Logic**: Flags vague, unbacked performance claims or qualitative adjectives lacking concrete quantitative metrics or specific mechanisms.
- **Pass Example**: *"This refactoring reduces latency from 120ms to 18ms by caching query plans."*
- **Fail Example**: *"This refactoring provides vastly superior performance and incredible speed."*

#### 7. `condition-before-action`
- **Severity**: `warning`
- **Autofix**: No (Confidence 0.75).
- **Logic**: Flags trailing conditional clauses placed after an imperative command.
- **Pass Example**: *"To reload configuration, send SIGHUP to the process."*
- **Fail Example**: *"Send SIGHUP to the process if you want to reload configuration."*

#### 8. `heading-sentence-case`
- **Severity**: `error`
- **Autofix**: Yes (Confidence 0.95). Converts Title Case to Sentence case while preserving uppercase acronyms (API, HTTP, CLI) and inline code spans.
- **Pass Example**: *"## Deployment configuration and setup"*
- **Fail Example**: *"## Deployment Configuration And Setup"*

#### 9. `descriptive-links`
- **Severity**: `error`
- **Autofix**: No (Confidence 1.0).
- **Logic**: Inspects `link` AST node text; flags generic anchor strings (*"here"*, *"click here"*, *"link"*, *"this page"*, *"read more"*).
- **Pass Example**: *"See the [PostgreSQL Connection Pooling Guide](docs/db.md)."*
- **Fail Example**: *"For connection pooling, click [here](docs/db.md)."*

#### 10. `serial-comma`
- **Severity**: `warning`
- **Autofix**: No (Confidence 0.85 — Advisory).
- **Pass Example**: *"Supports JSON, YAML, and TOML formats."*
- **Fail Example**: *"Supports JSON, YAML and TOML formats."*

#### 11. `ordered-sequences`
- **Severity**: `warning` (Advisory Only).
- **Autofix**: No (Confidence 0.75).
- **Logic**: Analyzes numbered lists (`1.`, `2.`). If items do not begin with imperative verbs, chronological markers (*"Step 1"*, *"First"*, *"Then"*), or sequential dependencies, advises using bulleted lists.
- **Pass Example**:
  ```markdown
  1. Clone the repository.
  2. Install dependencies.
  3. Run the test suite.
  ```
- **Fail Example**:
  ```markdown
  1. High performance.
  2. Modular design.
  3. Comprehensive documentation.
  ```

---

## 5. Safe Fix and Atomic Write Contract (Windows & POSIX)

When invoked via `fix` mode, the engine adheres to strict file safety guarantees:

1. **Atomic File Replacement Sequence**:
   - Write content to a sibling temporary file: `<file>.<pid>.<timestamp>.tmp`.
   - Flush buffers to physical disk via `fs.fsyncSync(fd)` and close descriptor.
   - Create collision-resistant backup at `<file>.<timestamp>.bak` (if collision occurs, append `.bak.1`).
   - **Windows Replacement Strategy**: Copy temporary file over target using `fs.copyFileSync(tempPath, targetPath)`, then unlink `tempPath`.
   - **POSIX Replacement Strategy**: Use atomic `fs.renameSync(tempPath, targetPath)`.
   - **Crash Recovery & Cleanup**: A `try / finally` block guarantees deletion of orphan `.tmp` files. If an unhandled exception occurs before target overwrite, the target remains unmodified; if target is corrupted, it is immediately restored from `.bak`.
2. **Encoding and BOM Preservation**: Reads and writes UTF-8. Existing UTF-8 Byte Order Marks (`\uFEFF`) are detected and preserved.
3. **Line Ending (EOL) Preservation**: Detects document line endings (`CRLF` on Windows vs `LF` on Unix) and preserves them during serialization.
4. **Autofix Confidence Threshold (>= 0.95)**: Strictly limited to rules with Confidence >= 0.95 (`ban-throat-clearing` [1.0] and `heading-sentence-case` [0.95]). All other rules are advisory and never mutated automatically.
5. **Idempotency**: Running `fix` multiple times on unchanged input produces zero diff and zero additional backups.
6. **Dry-Run Diff Preview**: With `--dry-run`, no disk mutations or backups occur; unified diffs are output to `stdout`.

---

## 6. Build and Runtime Architecture

To reconcile TypeScript development with a zero-dependency CLI runtime:

1. **Development Source (`src/`)**: Written in pure TypeScript (`src/index.ts`, `src/linter.ts`, `src/fixer.ts`, `src/compiler.ts`), tested with `vitest`.
2. **Build & Bundle Pipeline (`tsup` / `esbuild`)**:
   - Running `npm run build` compiles and bundles `src/cli.ts` into a standalone, zero-external-dependency CommonJS file at `bin/lint-heuristics.js`.
   - Includes embedded parsing logic without requiring runtime `node_modules` or global typescript installations when executed by agents or CI.
3. **Toolforge Entrypoint (`src/index.ts`)**: Exposes programmatic API for `./run-tool.ps1` and agent orchestrators.

---

## 7. Suppression Governance and Schema Contract

Authors can suppress rules locally with full audit traceability:

### Syntax Schema
```markdown
<!-- heuristics-disable rule-id author="soren" reason="Preserving quote from RFC 2119" until="2026-12-31" -->
This is an essentially required constraint.
<!-- heuristics-enable rule-id -->
```

### Attributes Contract:
- **`rule-id`** *(Required)*: The specific rule ID or `all` (Note: `rule-id="all"` is strictly restricted to `warning`-severity rules; `error`-severity rules cannot be suppressed using `all`).
- **`author`** *(Required)*: Identifier of the engineer or agent authoring the suppression.
- **`reason`** *(Required for `error`-severity rules)*: Non-empty rationale explaining the bypass.
- **`until`** *(Optional)*: ISO-8601 expiry date (`YYYY-MM-DD`).

### Expiration, Scope, and CI Policy:
1. **Scope Boundary**: A suppression applies from the opening comment until the closing `<!-- heuristics-enable rule-id -->` comment or until the next heading of equal or higher level.
2. **Expired Suppressions**: If `current_date > until`, the suppression is **Invalid/Expired**. The linter reports an error (`suppression-expired`) and executes active rule checks.
3. **Audit Reporting**: The linter prints an *Active Suppressions Audit Table* in CLI reports.
4. **CI Gate**: `--no-suppress` in CI fails builds that contain unapproved suppressions unless listed in `.heuristicsallow`.

---

## 8. Instruction-Surface Distribution and Global Integration

Instruction-surface distribution synchronizes writing discipline to agent rule files without pretending to control external LLM hosts.

### Surface Integration Matrix

| Platform / Agent | Configuration Path | Integration Type | Management Method |
|---|---|---|---|
| **Gemini Antigravity** | `~/.gemini/config/skills/writing-heuristics` | Skill Junction | PowerShell Junction |
| **Claude Code** | `~/.claude/skills/writing-heuristics` | Skill Junction | PowerShell Junction |
| **OpenCode / Agentic** | `~/.agents/skills/writing-heuristics` | Skill Junction | PowerShell Junction |
| **GitHub Copilot** | `.github/copilot-instructions.md` | Discipline Block | Managed comment region |
| **Universal (Codex / Any)** | `AGENTS.md` (IJFW Discipline Region) | Discipline Block | Managed IJFW sub-region |

### Managed Block Format (AGENTS.md and Copilot Instructions)
Inserted strictly inside `AGENTS.md` `<!-- IJFW-DISCIPLINE-START -->` and `<!-- IJFW-DISCIPLINE-END -->` using dedicated sub-region tags:

```markdown
<!-- IJFW-DISCIPLINE-START -->
<!-- TOOLFORGE-WRITING-DISCIPLINE-START -->
### Technical Writing and Communication Discipline
- **Anti-Slop**: Zero conversational filler, throat-clearing, or pre-announcements.
- **Google Developer Style**: Enforce active voice, second person ("you"), and sentence-case headings.
- **Sequencing**: State condition/prerequisite before instruction ("To start X, run Y").
- **Deep Authoring**: For docs, specs, and research packets, invoke the `writing-heuristics` skill.
<!-- TOOLFORGE-WRITING-DISCIPLINE-END -->
<!-- IJFW-DISCIPLINE-END -->
```

The synchronization tool replaces content exclusively between `<!-- TOOLFORGE-WRITING-DISCIPLINE-START -->` and `<!-- TOOLFORGE-WRITING-DISCIPLINE-END -->`, leaving surrounding IJFW discipline entries completely intact.

### Safe Junction Management Script (`bin/sync-global.ps1`)
```powershell
param (
    [switch]$Uninstall,
    [switch]$Verify
)

# Resolve source dynamically relative to script location
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$source = (Resolve-Path (Join-Path $scriptDir "..")).Path

if (!(Test-Path (Join-Path $source "skill.json"))) {
    Write-Error "CRITICAL: Valid skill source not found at $source"
    exit 1
}

$targets = @(
    "$HOME\.gemini\config\skills\writing-heuristics",
    "$HOME\.agents\skills\writing-heuristics",
    "$HOME\.claude\skills\writing-heuristics"
)

function Test-IsManagedJunction($path) {
    if (!(Test-Path $path)) { return $false }
    $item = Get-Item $path -Force
    if ($item.LinkType -ne "Junction") { return $false }
    $targetVal = (Get-Item $path).Target[0]
    return ($targetVal -replace '\\$','') -eq ($source -replace '\\$','')
}

if ($Verify) {
    foreach ($t in $targets) {
        $valid = Test-IsManagedJunction $t
        Write-Host "Target $t: $(if ($valid) {'VALID JUNCTION'} else {'NOT MANAGED / MISSING'})"
    }
    return
}

# Pre-flight check: ensure no targets are unmanaged real files/directories
foreach ($target in $targets) {
    if ((Test-Path $target) -and !(Test-IsManagedJunction $target)) {
        Write-Error "PRE-FLIGHT ABORT: Target path exists and is NOT a managed junction: $target. Manual inspection required."
        exit 1
    }
}

foreach ($target in $targets) {
    if (Test-Path $target) {
        if (Test-IsManagedJunction $target) {
            Write-Host "Removing managed junction: $target"
            [System.IO.Directory]::Delete($target)
        }
    }
    if (!$Uninstall) {
        $parent = Split-Path $target -Parent
        if (!(Test-Path $parent)) { New-Item -ItemType Directory -Path $parent -Force }
        New-Item -ItemType Junction -Path $target -Value $source
        Write-Host "Created managed junction: $target -> $source"
    }
}
```

---

## 9. Provisional Skill Package Specification (`skill.json`)

```json
{
  "id": "writing-heuristics",
  "name": "Writing Heuristics and Style Engine",
  "version": "1.0.0",
  "description": "Deterministic technical writing heuristics, anti-slop rules, and Google Developer Style enforcement engine",
  "author": "soren",
  "license": "MIT",
  "category": "governance",

  "metadata": {
    "runtime": "typescript",
    "entrypoint": "src/index.ts",
    "timeout": 30000,
    "tags": ["writing", "style", "lint", "anti-slop", "google-style", "governance"],
    "keywords": ["prose-lint", "writing-heuristics", "anti-slop", "compiler"]
  },

  "router": {
    "intent": ["writing", "style", "lint", "fix", "compile"],
    "confidence": "high"
  },

  "modes": {
    "supported": ["lint", "fix", "compile"],
    "default": "lint",
    "descriptions": {
      "lint": "Analyzes markdown content for style rule violations and outputs structured report",
      "fix": "Applies safe deterministic transformations with optional backup or dry-run diff preview",
      "compile": "Compiles heuristics.json into SKILL.md and documentation references"
    }
  },

  "governance": {
    "zeroDrift": true,
    "deterministic": true,
    "canonicalSource": "heuristics.json",
    "compiledArtifacts": ["SKILL.md", "docs/rules.md"]
  },

  "validation": {
    "testsRequiredBeforeActivation": true,
    "testRunner": "vitest",
    "requiredSuites": ["linter.test.ts", "fixer.test.ts", "cli.test.ts", "codegen.test.ts"]
  },

  "inputs": {
    "required": [],
    "optional": [
      { "name": "paths", "type": "array", "description": "File paths or glob patterns to lint or fix", "default": ["docs/**/*.md"] },
      { "name": "mode", "type": "string", "enum": ["lint", "fix", "compile"], "description": "Execution mode", "default": "lint" },
      { "name": "strict", "type": "boolean", "description": "Treat warnings as blocking errors", "default": false },
      { "name": "dryRun", "type": "boolean", "description": "Preview diff output without modifying files", "default": false },
      { "name": "stdin", "type": "boolean", "description": "Read markdown text directly from standard input", "default": false },
      { "name": "format", "type": "string", "enum": ["stylish", "json", "sarif"], "description": "Output format", "default": "stylish" }
    ]
  },

  "outputs": {
    "success": {
      "type": "object",
      "properties": {
        "status": { "type": "string" },
        "clean": { "type": "boolean" },
        "totalFilesScanned": { "type": "number" },
        "violationsCount": { "type": "number" },
        "violations": { "type": "array" }
      }
    },
    "error": {
      "type": "object",
      "properties": {
        "error": { "type": "string" },
        "code": { "type": "string" },
        "details": { "type": "object" }
      }
    }
  },

  "permissions": {
    "required": ["read:repo"],
    "optional": ["write:file"],
    "restrictions": ["delete:permanent"]
  },

  "integrations": {
    "toolforge": {
      "registered": false,
      "manifestPath": "manifest.json",
      "docPath": "docs/skills/writing-heuristics.md"
    },
    "distributed": {
      "syncable": false,
      "globalPaths": [
        "~/.gemini/config/skills/writing-heuristics",
        "~/.agents/skills/writing-heuristics",
        "~/.claude/skills/writing-heuristics"
      ]
    }
  }
}
```

---

## 10. Manifest Registration Schema & Activation Gate (`C:\dev\manifest.json`)

### Planned Registration Record
```json
{
  "version": "1.0.0",
  "description": "Deterministic technical writing heuristics and Google Developer Style enforcement engine",
  "timestamps": {
    "created": "<ISO-8601-GENERATED-AT-REGISTRATION>",
    "lastValidation": "<ISO-8601-GENERATED-AT-REGISTRATION>",
    "lastRun": null
  },
  "tags": ["writing", "style", "linting", "heuristics", "governance"],
  "status": "development",
  "name": "writing-heuristics",
  "runtime": "node",
  "id": "writing-heuristics",
  "entrypoint": "src/index.ts",
  "owner": "soren",
  "category": "governance",
  "health": {
    "canonical": true,
    "runtime": "untested",
    "distributed": false,
    "overall": "pending"
  },
  "dependencies": {
    "external": [],
    "internal": []
  }
}
```

### Explicit Activation Gate:
1. **Initial Registration**: The skill is registered with `status: "development"`, `health.runtime: "untested"`, `health.distributed: false`, and `health.overall: "pending"`.
2. **Runtime Verification**: `health.runtime` transitions from `"untested"` to `"healthy"` **only** after `vitest` executes and passes 100% of required test suites with zero failures.
3. **Distribution Verification**: `health.distributed` transitions from `false` to `true` **only** after `bin/sync-global.ps1 -Verify` succeeds across all targets.
4. **Final Activation**: `status` transitions to `"active"` and `health.overall` to `"good"` only when both runtime and distribution gates pass.

---

## 11. Standalone CLI Linter and Output Contract

### Output Formats and Stream Separation
- **`stylish` (Default)**: Human-readable colored output to `stdout`.
- **`json`**: Structured JSON schema output to `stdout`:
  ```json
  {
    "summary": { "filesScanned": 1, "errors": 0, "warnings": 1, "clean": false },
    "suppressions": [{ "ruleId": "ban-filler-adverbs", "author": "soren", "reason": "RFC citation", "file": "docs/db.md", "line": 42 }],
    "files": [{
      "filePath": "docs/db.md",
      "messages": [{ "ruleId": "serial-comma", "severity": "warning", "line": 12, "column": 5, "message": "Missing Oxford comma in list." }]
    }]
  }
  ```
- **`sarif`**: Static Analysis Results Interchange Format (SARIF v2.1.0) for GitHub Actions Code Scanning.
- **Stdin Stream Purity**: When processing stdin via `--stdin`, all diagnostic summaries are written strictly to `stderr`. In `fix --stdin` mode, `stdout` receives purely the transformed markdown document.

### Commands and Exit Codes
- `node bin/lint-heuristics.js check [globs...]`
- `node bin/lint-heuristics.js check --stdin`
- `node bin/lint-heuristics.js fix --dry-run [globs...]`
- `node bin/lint-heuristics.js fix [globs...]`
- **Exit `0`**: Clean (zero error violations, or warnings without `--strict`).
- **Exit `1`**: Lint Failure (1+ error violations, or warnings when `--strict` enabled).
- **Exit `2`**: Fatal Error (syntax failure, invalid flags, missing files).

---

## 12. Test Matrix and Verification Plan

1. **AST Parser and Rule Tests (`tests/linter.test.ts`)**:
   - Verify all 11 canonical rules against dedicated positive and negative fixtures.
   - Assert `remark-gfm` tables, inline code, and code blocks are 100% exempt from natural prose linting.
   - Test inline suppression parsing, `author` and `reason` enforcement, and expired `until` date failures.
2. **Safe Fix and Atomic Engine Tests (`tests/fixer.test.ts`)**:
   - Assert atomic replacement, sync flush, and temp cleanup behavior.
   - Assert CRLF vs LF line ending preservation.
   - Assert idempotency: 2nd run produces 0 diff.
3. **CLI Contract Tests (`tests/cli.test.ts`)**:
   - Assert exit codes (0, 1, 2).
   - Assert `--stdin` stream separation (diagnostics to stderr, fixed prose to stdout).
   - Assert JSON and SARIF output compliance.
4. **Drift and Codegen Tests (`tests/codegen.test.ts`)**:
   - Execute compiler and assert both `SKILL.md` and `docs/rules.md` match `heuristics.json` byte-for-byte.
5. **Toolforge Registration and Governance**:
   - Pass `Test-Json` on `skill.json`.
   - Pass Toolforge validation suite via `npm test`.
   - Complete `/caveman-review` on git diff.
