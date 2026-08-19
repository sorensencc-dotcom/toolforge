# Toolforge Writing Heuristics and Style Enforcement Engine

**Document Status:** Spec Review (Pre-Implementation Design — Revision 4)
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
| **Google Style** | `heading-sentence-case`, `descriptive-links`, `avoid-first-person-plural`, `use-second-person`, `condition-before-action`, `serial-comma` | `error` / `warning` | [Google Developer Style Guide](https://developers.google.com/style) | CC BY 4.0 |
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

### AST Parser Scope and Boundary Rules
The lint engine converts Markdown documents into an Abstract Syntax Tree (AST) using `unified` / `remark-parse`.

- **Parsed Prose Nodes**: `paragraph`, `heading`, `list`, `listItem`, `blockquote`.
- **Parsed Metadata Nodes**:
  - `link` nodes: Inspected for anchor text (`link.children`) and destination URL for `descriptive-links`.
  - `html` comment nodes: Parsed exclusively by the Directive Lexer for suppression commands (`<!-- heuristics-disable ... -->`).
- **Exempt Nodes (Strictly Ignored for Prose Linting)**:
  - `code` (fenced code blocks)
  - `inlineCode` (inline code spans like variable names)
  - `table`, `tableRow`, `tableCell`
  - General HTML markup/tags (non-comment HTML)
  - Frontmatter blocks (YAML/TOML headers)

### Canonical Heuristics Catalog

#### 1. `ban-throat-clearing`
- **Severity**: `error`
- **Autofix**: Yes (strips leading conversational opener).
- **Confidence**: High (1.0)
- **Scope**: Beginning of prose paragraphs.
- **Pattern**: `^(Certainly|Sure thing|Sure|Here is|In this section|Let's dive|Note that|Allow me to)\b`
- **Pass Example**: *"To configure the client, supply your API key in the environment."*
- **Fail Example**: *"Certainly! In this section, we will delve into configuring the client."*

#### 2. `ban-filler-adverbs`
- **Severity**: `warning`
- **Autofix**: No (requires contextual prose rewrite).
- **Confidence**: Medium (0.85)
- **Target Terms**: `essentially`, `basically`, `crucial`, `game-changing`, `delve`, `comprehensive`, `seamlessly`.
- **Pass Example**: *"This update reduces memory overhead by 40%."*
- **Fail Example**: *"This game-changing update seamlessly and essentially eliminates overhead."*

#### 3. `avoid-first-person-plural`
- **Severity**: `warning`
- **Autofix**: No
- **Confidence**: High (0.90)
- **Logic**: Flags first-person plural (*"we recommend"*, *"let's"*, *"in our opinion"*) in technical instructions.
- **Pass Example**: *"Install dependencies before starting the service."*
- **Fail Example**: *"We recommend that you install dependencies first."*

#### 4. `use-second-person`
- **Severity**: `warning`
- **Autofix**: No
- **Confidence**: Medium (0.80)
- **Logic**: Encourages direct second-person address (*"you"*) or imperative mood for instructions; flags third-person passive abstraction (*"the user must..."*).
- **Pass Example**: *"You can configure the timeout in `config.json`."*
- **Fail Example**: *"The developer should configure the timeout in `config.json`."*

#### 5. `condition-before-action`
- **Severity**: `warning`
- **Autofix**: No
- **Confidence**: Medium (0.75)
- **Logic**: Flags trailing conditional clauses after an imperative command.
- **Pass Example**: *"To reload configuration, send SIGHUP to the process."*
- **Fail Example**: *"Send SIGHUP to the process if you want to reload configuration."*

#### 6. `heading-sentence-case`
- **Severity**: `error`
- **Autofix**: Yes (converts Title Case to Sentence case while preserving uppercase acronyms and inline code).
- **Confidence**: High (0.95)
- **Pass Example**: *"## Deployment configuration and setup"*
- **Fail Example**: *"## Deployment Configuration And Setup"*

#### 7. `descriptive-links`
- **Severity**: `error`
- **Autofix**: No (requires semantic context).
- **Confidence**: High (1.0)
- **Logic**: Inspects `link` AST node text; flags generic anchor strings (*"here"*, *"click here"*, *"link"*, *"this page"*, *"read more"*).
- **Pass Example**: *"See the [PostgreSQL Connection Pooling Guide](docs/db.md)."*
- **Fail Example**: *"For connection pooling, click [here](docs/db.md)."*

#### 8. `serial-comma`
- **Severity**: `warning`
- **Autofix**: No (Advisory)
- **Confidence**: Medium (0.85)
- **Pass Example**: *"Supports JSON, YAML, and TOML formats."*
- **Fail Example**: *"Supports JSON, YAML and TOML formats."*

#### 9. `ordered-sequences`
- **Severity**: `warning` (Advisory)
- **Autofix**: No
- **Confidence**: Medium (0.75)
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

## 5. Safe Fix and Atomic Write Contract

When invoked via `fix` mode, the engine adheres to strict file safety guarantees across Windows and POSIX:

1. **Atomic File Replacement**:
   - Content is written to a temporary sibling file: `<file>.<pid>.<random>.tmp`.
   - Buffers are flushed to physical disk via `fs.fsyncSync`.
   - On Windows: The existing file is backed up to `<file>.<timestamp>.bak`, the temporary file replaces the target atomically, and temp files are cleaned up in a `finally` block.
   - On POSIX: Uses atomic `fs.renameSync`.
2. **Encoding and BOM Preservation**: Files are read and written as UTF-8. If a UTF-8 Byte Order Mark (`\uFEFF`) is detected, it is preserved during serialization.
3. **Line Ending (EOL) Preservation**: The engine detects whether the original file uses `CRLF` (Windows) or `LF` (POSIX) line endings and preserves them consistently.
4. **Collision-Resistant Backups**: Backup files are created at `<file>.<timestamp>.bak`. If a collision occurs, an incremental counter (`.bak.1`) is appended.
5. **Autofix Confidence Threshold (>= 0.95)**: Only deterministic transforms with **Confidence >= 0.95** (`ban-throat-clearing` [1.0], `heading-sentence-case` [0.95]) are auto-mutated. Sub-threshold rules (`serial-comma` [0.85], `active-voice` [0.80]) are strictly advisory and never auto-mutated.
6. **Idempotency**: Running `fix` multiple times on unchanged input produces zero diff and zero additional backups.
7. **Dry-Run Diff Preview**: With `--dry-run`, no disk mutations or backups occur; unified diffs are output to `stdout`.

---

## 6. Build and Runtime Architecture

To reconcile TypeScript development with a zero-dependency CLI runtime:

1. **Development Source (`src/`)**: Written in pure TypeScript (`src/index.ts`, `src/linter.ts`, `src/fixer.ts`, `src/compiler.ts`), tested with `vitest`.
2. **Build & Bundle Pipeline (`tsup` / `esbuild`)**:
   - Running `npm run build` compiles and bundles `src/cli.ts` into a standalone, zero-external-dependency CommonJS file at `bin/lint-heuristics.js`.
   - Includes embedded parsing logic without requiring runtime node_modules or global typescript installations when executed by agents or CI.
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
- **`rule-id`** *(Required)*: The specific rule ID or `all`.
- **`author`** *(Required)*: Identifier of the engineer or agent authoring the suppression.
- **`reason`** *(Required for `error`-severity rules)*: Non-empty rationale explaining the bypass.
- **`until`** *(Optional)*: ISO-8601 expiry date (`YYYY-MM-DD`).

### Expiration and CI Policy:
1. **Expired Suppressions**: If `current_date > until`, the suppression is **Invalid/Expired**. The linter reports an error (`suppression-expired`) and executes active rule checks.
2. **Audit Reporting**: The linter prints an *Active Suppressions Audit Table* in CLI reports.
3. **CI Gate**: `--no-suppress` in CI fails builds that contain unapproved or unjustified suppressions.

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
| **Universal (Codex / Any)** | `AGENTS.md` (Lines 85–86) | Discipline Block | Managed IJFW Discipline region |

### Managed Block Format
```markdown
<!-- TOOLFORGE-WRITING-DISCIPLINE-START -->
### Technical Writing and Communication Discipline
- **Anti-Slop**: Zero conversational filler, throat-clearing, or pre-announcements.
- **Google Developer Style**: Enforce active voice, second person ("you"), and sentence-case headings.
- **Sequencing**: State condition/prerequisite before instruction ("To start X, run Y").
- **Deep Authoring**: For docs, specs, and research packets, invoke the `writing-heuristics` skill.
<!-- TOOLFORGE-WRITING-DISCIPLINE-END -->
```

### Safe Junction Management Script (`bin/sync-global.ps1`)
```powershell
param (
    [switch]$Uninstall,
    [switch]$Verify
)

$source = "C:\dev\skills\writing-heuristics"
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

foreach ($target in $targets) {
    if (Test-Path $target) {
        if (Test-IsManagedJunction $target) {
            Write-Host "Removing managed junction: $target"
            [System.IO.Directory]::Delete($target)
        } else {
            Write-Error "ABORT: Target directory exists and is NOT a managed junction: $target. Please inspect manually."
            continue
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

## 10. Manifest Planned Schema and Upsert Contract (`C:\dev\manifest.json`)

*Note: Planned registration template to be inserted into `manifest.json` upon test completion.*

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

### Idempotent Manifest Upsert Algorithm
When registration executes:
1. Parse `C:\dev\manifest.json`.
2. Locate existing entry by `item.id === "writing-heuristics"`.
3. **If found (Update)**:
   - Preserve original `timestamps.created`.
   - Update `version`, `description`, `tags`, `health`, `entrypoint`, and update `timestamps.lastValidation` to `new Date().toISOString()`.
4. **If not found (Append)**:
   - Set both `timestamps.created` and `timestamps.lastValidation` to `new Date().toISOString()`.
   - Append record to `manifest.skills` array.
5. Format and save `manifest.json` with 2-space indentation.

---

## 11. Standalone CLI Linter Contract

### Commands and Flags
- `node bin/lint-heuristics.js check [globs...]`: Analyzes files (e.g. `docs/**/*.md`).
- `node bin/lint-heuristics.js check --stdin`: Reads from stdin; mutually exclusive with file path arguments.
- `node bin/lint-heuristics.js check --strict`: Treats warnings as blocking errors (Exit 1).
- `node bin/lint-heuristics.js check --format=json|sarif|stylish`: Selects output format.
- `node bin/lint-heuristics.js fix --dry-run [globs...]`: Prints unified diff to stdout.
- `node bin/lint-heuristics.js fix [globs...]`: Safely mutates files with automatic backup.
- `cat file.md | node bin/lint-heuristics.js fix --stdin`: Emits fixed markdown directly to stdout.

### Exit Codes Contract
- `0`: Clean (no error violations, or warnings without `--strict`).
- `1`: Lint Failure (1+ error violations, or warnings when `--strict` enabled).
- `2`: Fatal Error (invalid flags, missing files, mutual exclusivity violation).

---

## 12. Test Matrix and Verification Plan

1. **AST Parser and Rule Tests (`tests/linter.test.ts`)**:
   - Verify all 9 rules against dedicated positive and negative fixtures.
   - Assert code blocks, inline code, and tables are 100% exempt from linting.
   - Assert link node text and URL targets are inspected for `descriptive-links`.
   - Test inline suppression parsing, required `author` and `reason` validation, and expired `until` date errors.
2. **Safe Fix and Atomic Engine Tests (`tests/fixer.test.ts`)**:
   - Assert atomic replacement, sync flush, and temp cleanup behavior.
   - Assert CRLF vs LF line ending preservation.
   - Assert idempotency: 2nd run produces 0 diff.
3. **CLI Contract Tests (`tests/cli.test.ts`)**:
   - Assert exit codes (0, 1, 2).
   - Assert `--stdin` and `--dry-run` diff output formatting.
   - Assert error thrown when combining file paths with `--stdin`.
4. **Drift and Codegen Tests (`tests/codegen.test.ts`)**:
   - Execute compiler and assert both `SKILL.md` and `docs/rules.md` match `heuristics.json` byte-for-byte.
5. **Toolforge Registration and Governance**:
   - Pass `Test-Json` on `skill.json`.
   - Pass Toolforge validation suite via `npm test`.
   - Complete `/caveman-review` on git diff.
