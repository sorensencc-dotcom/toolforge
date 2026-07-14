---
title: Toolforge Marketplace v1.0 — Charter & Specification
date: 2026-07-13
version: "1.0"
status: DRAFT
owner: "Tier 1 (Chris Sorensen)"
authority: "Tier 1 decision required to lock"
phase: "Phase 8 Wave D (Parallel submission pipeline)"
conformance_check: "PENDING"
---

# Toolforge Marketplace v1.0 — Charter & Specification

**Executive Summary:**  
Transform Toolforge from governance-only (skill eligibility rules in CLAUDE.md) into a first-class plugin marketplace. Users discover, install, and manage skills via registry + CLI + submission pipeline. Authority: Tier 1 decides scope/approval; Tier 2 implements; Tier 3 automates registration.

**Scope In:**
- Plugin manifest schema (extends existing SKILL.json)
- Registry service (JSON source of truth)
- CLI commands: `toolforge install`, `toolforge submit`, `toolforge list`
- Submission validator (manifest + governance conformance checks)
- Governance integration (skill eligibility → marketplace publish gate)

**Scope Out:**
- Marketplace UI/dashboard (Phase 9)
- Discovery API (Phase 9)
- Plugin sandbox permissions (Phase 10)
- Versioning/rollback (Phase 10)

---

## Critical Invariants

**Registry Immutability:**
- `docs/toolforge/registry.json` is append-only (no edits, deletions, rewrites)
- All changes logged to git history (audit trail)
- No manual mutations; only via `registry-tool` (Tier 3 automation)

**Manifest Backward Compatibility:**
- SKILL.json + `_marketplace` fields must not break existing skill tooling
- Existing tools that ignore `_marketplace` must continue to work
- Schema versioning: `_marketplace.registry_entry: "toolforge-marketplace:1.0"`

**Determinism:**
- All CLI commands return deterministic output (same inputs → same output)
- No interactive prompts by default (flags to enable if needed)
- All validators produce reproducible conformance reports

**Safety Boundaries (Absolute):**
- No skill published without Tier 1 approval
- No registry entry quarantined without audit log
- No installation without checksum verification
- Validator must not execute untrusted code (schema validation only, no eval)

---

## Failure Modes & Recovery

| Failure | Behavior | Recovery |
|---------|----------|----------|
| `toolforge install` mid-way fails | Partial install in `~/.toolforge/skills/<id>`, marked BROKEN in log | Retry install (idempotent) or `toolforge uninstall <id>` |
| Validator detects non-conformance | Submission marked REJECTED + report generated + PR closed | Developer fixes + resubmits (new submission ID) |
| Registry entry quarantined (safety issue found) | Entry marked `quarantined` in registry + reason logged | Tier 1 investigates + decides: revoke or restore |
| Checksum mismatch on install | Installation fails, error printed, local copy deleted | User checks registry.json validity + retries |
| Malformed SKILL.json | Validator fails + blocks submission | Developer fixes manifest + resubmits |

---

## Interfaces

### CLI Command Signatures

```powershell
# List all published plugins
toolforge list
  [--category <string>]
  [--status <published|pending|deprecated>]
  [--format <table|json|csv>]
  # Output: table with columns: ID, Name, Version, Category, Status, Published Date
  # Exit code: 0 (success) | 1 (error)

# Install plugin
toolforge install <id> [--version <semver>] [--force]
  # Output: progress lines + final status (✓ Installed | ✗ Failed)
  # Exit code: 0 (success) | 1 (error)

# Submit for publication
toolforge submit <path> [--dry-run]
  # Output: submission ID + conformance report (human + JSON)
  # Exit code: 0 (success) | 1 (error)
```

### Plugin Manifest Schema (`_marketplace`)

```json
{
  "_marketplace": {
    "registry_entry": "toolforge-marketplace:1.0",
    "submission_status": "pending|approved|published|rejected|deprecated",
    "published_date": "ISO8601 or null",
    "installed_count": 0,
    "marketplace_visibility": "public|private|deprecated",
    "submission_id": "sub-<uuid> or null",
    "conformance_check": {
      "passed": boolean,
      "timestamp": "ISO8601",
      "checks": {
        "manifest_valid": boolean,
        "tests_pass": boolean,
        "docs_complete": boolean,
        "governance_aligned": boolean,
        "caveman_review": "pending|pass|fail"
      },
      "blockers": [string]
    }
  }
}
```

### Registry File Schema

```json
{
  "registry_version": "1.0",
  "generated": "ISO8601",
  "plugins": [
    {
      "id": "string (lowercase, hyphens, no spaces)",
      "name": "string",
      "version": "semver",
      "category": "string (from allowed list)",
      "description": "string",
      "owner": "string",
      "status": "published|quarantined",
      "published_date": "ISO8601",
      "manifest_path": "string (relative to repo root)",
      "install_path": "string (relative to repo root)",
      "checksum": "sha256-<hash>",
      "install_command": "string",
      "tags": [string],
      "installed_count": number,
      "conformance_check": {
        "passed": boolean,
        "timestamp": "ISO8601"
      }
    }
  ],
  "metadata": {
    "total_plugins": number,
    "published_count": number,
    "pending_count": number,
    "deprecated_count": number
  }
}
```

### Submission Report Schema

```json
{
  "submission_id": "sub-<uuid>",
  "skill_id": "string",
  "skill_version": "semver",
  "timestamp": "ISO8601",
  "status": "pending_approval|approved|rejected",
  "checks": {
    "manifest": { "passed": boolean, "errors": [string], "warnings": [string] },
    "tests": { "passed": boolean, "coverage": number, "errors": [string] },
    "docs": { "passed": boolean, "errors": [string], "warnings": [string] },
    "conformance": { "passed": boolean, "errors": [string], "warnings": [string] },
    "caveman_review": { "passed": boolean, "status": "pending|pass|fail", "notes": "string" }
  },
  "blockers": [string],
  "warnings": [string],
  "recommendation": "APPROVE|HOLD|REJECT",
  "caveman_reviewer": "string (username or pending)",
  "pr_url": "string (link to Tier 1 review PR)"
}
```

---

## Architecture

### 1. Plugin Manifest Schema

Extends existing SKILL.json with marketplace fields. Location: `skills/<id>/SKILL.json`

```json
{
  "_marketplace": {
    "registry_entry": "toolforge-marketplace:1.0",
    "submission_status": "pending|approved|published|deprecated",
    "published_date": "2026-07-13T00:00:00Z",
    "installed_count": 0,
    "marketplace_visibility": "public|private|deprecated",
    "submission_id": "sub-uuid-xxx",
    "conformance_check": {
      "passed": false,
      "timestamp": "2026-07-13T00:00:00Z",
      "checks": {
        "manifest_valid": true,
        "tests_pass": true,
        "docs_complete": true,
        "governance_aligned": false,
        "caveman_review": "pending"
      },
      "blockers": []
    }
  },
  "id": "toolforge-drift-monitor",
  "name": "Toolforge Drift Monitor",
  "version": "0.1.0",
  "status": "active",
  "category": "monitoring",
  "description": "Detects drift between canonical, distributed, manifest, and Cowork systems",
  "runtime": "typescript",
  "entrypoint": "src/index.ts",
  "owner": "soren",
  "timeout": 30000,
  "permissions": {
    "required": [],
    "optional": []
  },
  "dependencies": {
    "external": [],
    "internal": []
  },
  "integrations": {
    "cowork": {
      "registered": false,
      "pluginType": "skill",
      "icon": "zap",
      "registrationPath": "cowork://toolforge/skills/toolforge-drift-monitor",
      "status": "pending_registration"
    }
  },
  "tags": [],
  "tooltip": "Detects drift between canonical, distributed, manifest, and Cowork systems"
}
```

**Key fields:**
- `_marketplace.*` — all marketplace-specific state (submission status, conformance, visibility)
- `submission_status` — workflow state (pending → approved → published)
- `conformance_check` — results of validator (pass/fail + detailed checks)
- `marketplace_visibility` — public/private/deprecated (user-facing)

---

### 2. Registry Service

Location: `docs/toolforge/registry.json`

Single source of truth for all published plugins. Updated atomically by CI after Tier 1 approval.

```json
{
  "registry_version": "1.0",
  "generated": "2026-07-13T00:00:00Z",
  "plugins": [
    {
      "id": "toolforge-drift-monitor",
      "name": "Toolforge Drift Monitor",
      "version": "0.1.0",
      "category": "monitoring",
      "description": "Detects drift between canonical, distributed, manifest, and Cowork systems",
      "owner": "soren",
      "status": "published",
      "published_date": "2026-07-13T00:00:00Z",
      "manifest_path": "skills/toolforge-drift-monitor/SKILL.json",
      "install_path": "skills/toolforge-drift-monitor",
      "checksum": "sha256-abc123...",
      "install_command": "toolforge install toolforge-drift-monitor",
      "tags": ["governance", "monitoring"],
      "installed_count": 0,
      "conformance_check": {
        "passed": true,
        "timestamp": "2026-07-13T00:00:00Z"
      }
    }
  ],
  "metadata": {
    "total_plugins": 1,
    "published_count": 1,
    "pending_count": 0,
    "deprecated_count": 0
  }
}
```

**Governance:**
- Tier 1 approves submissions → Tier 2 updates registry → Tier 3 CI publishes
- Immutable append-only log of changes (git history)
- Registry published to `docs/toolforge/registry.json` (canonical URL)

---

### 3. CLI Commands

New skill: `toolforge-cli` (PowerShell, entrypoint: `src/cli.ps1`)

#### 3.1 `toolforge list [--category <cat>] [--status <status>]`
List all published plugins.

```powershell
toolforge list
# Output:
# ID                           Category    Version  Status
# toolforge-drift-monitor      monitoring  0.1.0    published
# tool-lifecycle-manager       pipeline    0.1.0    published

toolforge list --category monitoring
toolforge list --status pending
```

#### 3.2 `toolforge install <id> [--version <v>]`
Install plugin to local skills directory.

```powershell
toolforge install toolforge-drift-monitor
# Output:
# Installing: Toolforge Drift Monitor (0.1.0)
# Source: skills/toolforge-drift-monitor
# Destination: ~/.toolforge/skills/toolforge-drift-monitor
# Status: ✓ Installed (checksum verified)
```

**Behavior:**
1. Verify plugin exists in registry
2. Validate checksum
3. Copy plugin to `~/.toolforge/skills/<id>`
4. Register in local INDEX.md
5. Log to `~/.toolforge/install-log.json`

#### 3.3 `toolforge submit <skill-path>`
Submit skill for marketplace publication.

```powershell
toolforge submit ./skills/my-skill
# Output:
# Submission ID: sub-uuid-xxx
# Status: manifest validated ✓
# Status: tests pass ✓
# Status: docs complete ✓
# Status: governance check pending
# Status: waiting for Tier 1 approval
#
# Next: https://github.com/soren/c--dev/pull/123 (conformance PR)
```

**Behavior:**
1. Validate manifest (SKILL.json present + valid)
2. Run tests (`npm test` or equivalent)
3. Check docs (README or docs/ present)
4. Run governance conformance check
5. Create submission record + PR with conformance report
6. Wait for Tier 1 approval

---

### 4. Submission Validator

New skill: `toolforge-submission-validator` (TypeScript, entrypoint: `src/validate.ts`)

Runs before Tier 1 approval gate. Checks:

#### 4.1 Manifest Validation
- SKILL.json exists + valid JSON
- Required fields present: `id`, `name`, `version`, `description`, `entrypoint`, `runtime`, `owner`
- `version` is semver
- `runtime` is known (typescript|powershell|bash|node)
- `category` is from allowed list (monitoring|pipeline|utility|integration|governance)
- No fields outside schema

#### 4.2 Test Validation
- `npm test` passes (or equivalent)
- Test coverage > 70% (if tests exist)
- No test skips (all tests run)

#### 4.3 Documentation Validation
- README.md or docs/README.md exists
- Includes: purpose, usage example, inputs/outputs, permissions required
- Links resolve (no broken [[wiki-links]])

#### 4.4 Governance Conformance
- No duplication with existing skills (grep similarity < 70%)
- Follows naming convention: `<scope>-<function>` (lowercase, hyphens)
- Owner is valid (registered in CLAUDE.md)
- No overlapping categories (avoid 3+ similar skills)
- Permissions align with scope (e.g., "monitoring" skill doesn't require network.write)

#### 4.5 Caveman Review
- Manual review by Tier 1 (automated check confirms review done)
- No blockers (style, structure, scope)

**Output: Conformance Report**

```json
{
  "submission_id": "sub-uuid-xxx",
  "skill_id": "toolforge-drift-monitor",
  "timestamp": "2026-07-13T00:00:00Z",
  "status": "pending_approval",
  "checks": {
    "manifest": { "passed": true, "errors": [] },
    "tests": { "passed": true, "coverage": 75 },
    "docs": { "passed": true, "warnings": [] },
    "conformance": { "passed": false, "errors": ["Caveman review pending"] },
    "caveman_review": { "passed": false, "status": "waiting_for_tier_1" }
  },
  "blockers": ["Caveman review pending"],
  "warnings": [],
  "recommendation": "HOLD FOR CAVEMAN REVIEW"
}
```

---

### 5. Governance Integration

#### 5.1 Skill Eligibility → Marketplace Publish Gate

**Current (CLAUDE.md):**
Skills are eligible for Toolforge if:
- Registered in manifest.json with complete metadata
- Structure: skill.json + src/ + tests/ + docs/
- Tests pass locally
- Documentation complete
- Caveman review pass

**New (Toolforge Marketplace v1.0):**
Same eligibility rules. **Additional gate: submission validator + Tier 1 approval.**

Workflow:
```
Skill written
  ↓
Caveman review pass (existing)
  ↓
Developer runs: toolforge submit
  ↓
Submission validator runs (automated)
  ↓
Conformance report generated + PR created
  ↓
Tier 1 reviews + approves/rejects
  ↓
Approved → Registry updated (Tier 3 CI)
↓
Published: users can `toolforge install`
```

#### 5.2 Authority Model

| Tier | Authority | Action |
|------|-----------|--------|
| **Tier 1** | Approves publication | Review conformance report + caveman notes. Decide: publish\|reject\|request-changes. |
| **Tier 2** | Submits + implements changes | Developer runs validator, fixes issues, resubmits. |
| **Tier 3** | Automates registration | CI: on Tier 1 approval, update registry.json + publish. |

#### 5.3 Output Classification

| Class | Example | Approval |
|-------|---------|----------|
| Governance | Skill eligibility amendment | Tier 1 |
| Operational | Skill implementation + submission | Tier 2 |
| Template | Submission form, checklist | Tier 2 |

---

## Implementation Phases

### Phase 8 (Current) — Wave D: Toolforge CLI + Validator
**Deliverables:**
- Plugin manifest schema (extends SKILL.json)
- Registry service (registry.json)
- `toolforge-cli` skill (list, install, submit commands)
- `toolforge-submission-validator` skill (manifest + governance checks)
- Governance amendment (CLAUDE.md updated)

**Timeline:** 2 weeks (target 2026-07-26)

**Tests:**
- CLI: `toolforge list` returns all published skills ✓
- CLI: `toolforge install <id>` downloads + verifies checksum ✓
- Validator: detects missing SKILL.json ✓
- Validator: detects failed tests ✓
- Validator: detects missing docs ✓
- Validator: detects duplication (>70% similarity) ✓
- Validator: detects naming violations ✓
- Conformance report generated + accurate ✓

### Phase 9 — Wave A: Marketplace UI + Discovery API
**Deliverables:**
- Dashboard plugin listing (Cast Iron Charlie)
- Search + filter UI
- Discovery API (`/plugins`, `/plugins/:id`, etc.)
- Install button + status tracking
- Update notifications

**Timeline:** 3 weeks (target 2026-08-16)

### Phase 10 — Wave B: Advanced Features
**Deliverables:**
- Per-plugin sandbox permissions
- Version history + rollback
- Plugin health monitoring
- Dependency resolution

**Timeline:** 3 weeks (target 2026-09-06)

---

## Success Criteria

1. ✓ Manifest schema defined + backward compatible with SKILL.json
2. ✓ Registry service operational (single source of truth)
3. ✓ CLI commands working (list, install, submit)
4. ✓ Submission validator passing all checks
5. ✓ Governance integrated (Tier 1/2/3 authority clear)
6. ✓ Conformance check report accurate + actionable
7. ✓ 2+ existing skills (toolforge-drift-monitor, tool-lifecycle-manager) published
8. ✓ All tests passing (100% coverage)
9. ✓ Documentation complete (README + usage examples)
10. ✓ Zero safety violations (conformance gate enforced)

---

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Registry becomes stale | Tier 3 CI auto-publishes after approval. Append-only log. |
| Malformed submissions break installer | Validator catches 95% of errors. Manual Tier 1 review catches rest. |
| Skill duplication (similar skills published) | Conformance check detects >70% similarity. Tier 1 rejects duplicates. |
| Installation conflicts | Each plugin isolated in `~/.toolforge/skills/<id>`. No global namespace. |
| Safety boundary violation | Validator checks permissions against scope. Tier 1 manual review. |

---

## Integration Points

**Upstream:**
- CLAUDE.md skill eligibility rules → inputs to conformance gate

**Downstream:**
- Marketplace UI (Phase 9) → consumes registry.json + install commands
- Discovery API (Phase 9) → reads registry.json
- Plugin sandbox (Phase 10) → enforces per-plugin permissions

**Parallel:**
- gstack ecosystem — toolforge skills can be used in gstack workflows
- CIC documentary treatment — Toolforge marketplace can manage CIC-specific skills

---

## Appendix: File Structure

```
c:\dev\
├── CLAUDE.md (amended: skill eligibility → marketplace publish)
├── skills/
│   ├── toolforge-drift-monitor/
│   │   ├── SKILL.json (+ _marketplace fields)
│   │   ├── src/
│   │   ├── tests/
│   │   └── README.md
│   ├── tool-lifecycle-manager/
│   │   ├── SKILL.json (+ _marketplace fields)
│   │   ├── src/
│   │   ├── tests/
│   │   └── README.md
│   ├── toolforge-cli/ [NEW]
│   │   ├── SKILL.json
│   │   ├── src/cli.ps1
│   │   ├── tests/cli.test.ps1
│   │   └── README.md
│   └── toolforge-submission-validator/ [NEW]
│       ├── SKILL.json
│       ├── src/validate.ts
│       ├── tests/validate.test.ts
│       └── README.md
├── docs/
│   └── toolforge/
│       ├── registry.json [NEW - source of truth]
│       ├── SUBMISSION_GUIDE.md [NEW]
│       ├── CONFORMANCE_REPORT_TEMPLATE.md [NEW]
│       └── SCHEMA.md [NEW - manifest schema]
└── .context/
    └── submissions/
        └── sub-uuid-xxx.json [submission records]
```

---

## Approval & Amendment Log

| Version | Date | Status | Decision |
|---------|------|--------|----------|
| 1.0 | 2026-07-13 | DRAFT | Awaiting Tier 1 review |

**Conformance Check:** PENDING (to be run after charter lock)

---

**End of Charter**

**For Tier 1 Review:**
- Does scope conform to existing infrastructure?
- Are authority tiers clear?
- Are success criteria verifiable?
- Any safety concerns?
- Approved to proceed → Phase 8 Wave D?

