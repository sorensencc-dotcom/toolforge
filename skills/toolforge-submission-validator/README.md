# Toolforge Submission Validator

Validates skill submissions against Toolforge Marketplace conformance gate.

## Purpose

Enforces marketplace quality standards through automated conformance checks before submission to caveman review.

## Usage

```bash
npm run validate -- <skill-path>
```

Returns JSON ConformanceReport with validation results and recommendation (approve/hold/reject).

## Inputs

- `skill_path` (string): Absolute path to skill directory

## Outputs

ConformanceReport JSON:
- `submission_id`: Unique submission identifier
- `skill_id`: Skill ID from SKILL.json
- `skill_version`: Version from SKILL.json
- `timestamp`: ISO 8601 timestamp
- `checks`: Object with results for:
  - `manifest_valid`: SKILL.json valid (boolean)
  - `tests_pass`: Tests present and runnable (boolean | null)
  - `docs_complete`: README with required sections (boolean)
  - `governance_aligned`: Naming, owner, no unsafe code (boolean)
  - `caveman_review`: Always "pending" (awaits Tier 1)
- `blockers`: Array of failing checks
- `recommendation`: "approve" | "hold" | "reject"

## Permissions

- `file.read`: Read SKILL.json, docs, source
- `file.write`: Create submission records (optional)

## Conformance Checks

### 1. Manifest Valid
- SKILL.json exists and is valid JSON
- Required fields present (id, name, version, status, category, runtime, entrypoint, owner)
- Field patterns correct (id: ^[a-z0-9-]+$, version: semver)
- Enum values correct (status: active|deprecated|inactive)

### 2. Tests Pass
- Tests directory exists with files (tests/, test/, __tests__/)
- package.json defines test script
- Assumes pass if structure exists (CI runs actual tests)

### 3. Docs Complete
- README.md or docs/README.md exists
- Contains at least 2 of 3 sections: Purpose, Usage, Permissions

### 4. Governance Aligned
- Naming convention: id matches <scope>-<function> pattern
- Owner field present and non-empty
- No unsafe code patterns (eval, exec, Function constructor)
- Permissions properly defined

### 5. Caveman Review
- Always set to "pending"
- Manual Tier 1 approval required before publication

## Recommendation Logic

- **reject**: Manifest invalid or governance check failed
- **hold**: Blockers present but not critical (missing tests, incomplete docs)
- **approve**: All checks pass, ready for caveman review
