# TRM Frontmatter & Provenance Validator Test Suite & Hardening Design

## Overview
This specification details the test harness and hardening for the Stage 3 Topic Research Mining (TRM) frontmatter validator (`scripts/validate-chunks.mjs`). The validator acts as the sovereign gatekeeper of markdown provenance before raw chunks are compiled into master knowledge packs (`repo_knowledge_pack.txt`) and uploaded to NotebookLM.

The test suite ensures zero-trust validation across unit parsing, directory walking, and CLI exit codes to guarantee pre-commit hooks abort when malformed research notes enter the repository.

---

## Goals & Non-Goals

### Goals
1. **Unit-Level Robustness**: Assert parsing fidelity for YAML frontmatter across line ending schemes (Windows CRLF, POSIX LF), edge-case quoting, missing fences, and corrupt data.
2. **Schema & Provenance Enforcement**: Strictly validate mandatory fields (`source_title`, `repository`, `document_date`, `verification_status`, `category`) and verify enum constraints.
3. **Filesystem Isolation**: Exercise directory walking (`validateResearchDirectories`) against isolated temporary scratch directories without leaving persistent test artifacts.
4. **CLI & Subprocess Gating**: Assert that executing `node scripts/validate-chunks.mjs` directly via subprocess returns exit code `0` on clean trees and exit code `1` on malformed frontmatter.
5. **Cross-Runner Compatibility**: Author tests in TypeScript (`tests/validate-chunks.test.ts`) utilizing `node:test` and `node:assert/strict` executable via `npx tsx --test` and Vitest.

### Non-Goals
1. We are not rewriting the core validator in a heavy framework; `scripts/validate-chunks.mjs` remains a zero-dependency ES module.
2. We are not altering Stage 4 packaging (`repo_knowledge_pack.txt` generation) in this scope.

---

## Architecture & Test Suite Design

### File Structure
- **Target Source**: [`scripts/validate-chunks.mjs`](file:///c:/dev/scripts/validate-chunks.mjs)
- **Test File**: [`tests/validate-chunks.test.ts`](file:///c:/dev/tests/validate-chunks.test.ts)
- **Package Configuration**: [`package.json`](file:///c:/dev/package.json) (`"test:trm"` script added)

### Test Structure

```
tests/validate-chunks.test.ts
├── 1. extractFrontmatter Unit Tests
│   ├── Valid frontmatter with standard POSIX LF (\n)
│   ├── Valid frontmatter with Windows CRLF (\r\n)
│   ├── Quoted strings (single and double quotes stripped cleanly)
│   ├── Keys containing hyphens and underscores
│   ├── Corrupt/missing frontmatter blocks (returns null)
│   └── Non-string and empty string inputs (returns null)
│
├── 2. validateFileProvenance Unit Tests
│   ├── Compliant frontmatter passes with valid: true and errors: []
│   ├── Missing individual required fields (source_title, repository, etc.)
│   ├── Empty/whitespace-only field values rejected
│   ├── Valid verification_status values (verified, unverified, pending, active, archived)
│   ├── Invalid verification_status values rejected with descriptive message
│   └── document_date format checking
│
├── 3. Directory Walker & Ignore Filter Tests
│   ├── Valid directory tree passes with outcome.passed === true
│   ├── Invalid directory tree fails with outcome.passed === false and accurate failedFiles count
│   └── Ignored directory filter skips node_modules, .git, and .nlm_pack
│
└── 4. CLI Subprocess & Pre-Commit Gating Tests
    ├── Spawning CLI with clean directory returns exitCode 0
    └── Spawning CLI with malformed directory returns exitCode 1 and writes errors to stderr
```

---

## Execution & CI Integration

### Test Execution Commands
- **Direct run**: `npx tsx --test tests/validate-chunks.test.ts`
- **NPM script**: `npm run test:trm`
- **Pre-flight integration**: Appended to `npm run pre-flight` suite in `package.json`.

---

## Verification Criteria
1. All unit tests pass in under 500ms.
2. Isolated temporary directories are cleaned up after each test execution.
3. Exit codes 0 and 1 correctly signal commit approval or blocking in pre-commit hooks.
