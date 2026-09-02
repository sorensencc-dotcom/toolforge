---
title: Phase 8 Wave D Success Criteria Checklist
phase: Phase 8 Wave D
target_date: 2026-07-26
owner: Tier 2 (Implementation) / Tier 1 (Verification)
status: TEMPLATE FOR EXECUTION
---

# Phase 8 Wave D — Success Criteria (Binary Checklist)

**Mission:** Deliver Toolforge Marketplace v1.0 (4 deliverables: manifest schema, registry service, CLI, validator).

**Approval Gate:** All 40 criteria must be PASS to lock phase. Any FAIL → escalate to Tier 1.

---

## Deliverable 1: Plugin Manifest Schema

| # | Criterion | Evidence Location | Verifier | Status |
|----|-----------|-------------------|----------|--------|
| 1.1 | Schema file exists at `docs/toolforge/schemas/skill.marketplace.schema.json` | File system | Tier 2 | ☐ PASS / ☐ FAIL |
| 1.2 | Schema is valid JSONSchema Draft 7 | `ajv validate schema.json` | Tier 2 | ☐ PASS / ☐ FAIL |
| 1.3 | Schema defines `id` as required, pattern `^[a-z0-9-]+$` | Schema `properties.id` | Tier 2 | ☐ PASS / ☐ FAIL |
| 1.4 | Schema defines `version` as required, pattern semver `^\d+\.\d+\.\d+$` | Schema `properties.version` | Tier 2 | ☐ PASS / ☐ FAIL |
| 1.5 | Schema defines `_marketplace` object with `registry_entry: "toolforge-marketplace:1.0"` | Schema `properties._marketplace` | Tier 2 | ☐ PASS / ☐ FAIL |
| 1.6 | `_marketplace.submission_status` enum: [pending, approved, published, rejected, deprecated] | Schema `properties._marketplace.submission_status` | Tier 2 | ☐ PASS / ☐ FAIL |
| 1.7 | `_marketplace.conformance_check` object with `passed: boolean`, `checks: {...}`, `blockers: []` | Schema `properties._marketplace.conformance_check` | Tier 2 | ☐ PASS / ☐ FAIL |
| 1.8 | Manifest validator created at `docs/toolforge/validators/manifest-validator.ps1` | File system | Tier 2 | ☐ PASS / ☐ FAIL |
| 1.9 | Validator function `Validate-PluginManifest -Path <path> -Schema <schema>` executable | `./manifest-validator.ps1 -Path skills/toolforge-drift-monitor` | Tier 2 | ☐ PASS / ☐ FAIL |
| 1.10 | `toolforge-drift-monitor/SKILL.json` contains valid `_marketplace` fields | File content | Tier 2 | ☐ PASS / ☐ FAIL |
| 1.11 | `tool-lifecycle-manager/SKILL.json` contains valid `_marketplace` fields | File content | Tier 2 | ☐ PASS / ☐ FAIL |
| 1.12 | Both skills validate against schema without errors | `Validate-PluginManifest` output | Tier 2 | ☐ PASS / ☐ FAIL |
| 1.13 | Test suite `npm run test:manifest-schema` exists + passes 100% | Test output | Tier 2 | ☐ PASS / ☐ FAIL |
| 1.14 | Zero breaking changes to existing skill tooling | Code review | Tier 1 | ☐ PASS / ☐ FAIL |

**Deliverable 1 Status:** ☐ COMPLETE (all 14 criteria PASS) / ☐ BLOCKED (list failures)

---

## Deliverable 2: Registry Service

| # | Criterion | Evidence Location | Verifier | Status |
|----|-----------|-------------------|----------|--------|
| 2.1 | Registry file created at `docs/toolforge/registry.json` | File system | Tier 2 | ☐ PASS / ☐ FAIL |
| 2.2 | Registry contains `registry_version: "1.0"`, `plugins: []`, `metadata` object | File content | Tier 2 | ☐ PASS / ☐ FAIL |
| 2.3 | Registry tool created at `skills/toolforge-registry-manager/src/registry.ps1` | File system | Tier 2 | ☐ PASS / ☐ FAIL |
| 2.4 | Function `Add-PluginToRegistry -PluginId <id> -Path <path> -Checksum <checksum>` exists + works | `Add-PluginToRegistry` call | Tier 2 | ☐ PASS / ☐ FAIL |
| 2.5 | Function `Get-PluginFromRegistry -PluginId <id>` exists + returns plugin object or null | `Get-PluginFromRegistry` output | Tier 2 | ☐ PASS / ☐ FAIL |
| 2.6 | Function `List-PublishedPlugins [-Category <cat>]` exists + returns array | `List-PublishedPlugins` output | Tier 2 | ☐ PASS / ☐ FAIL |
| 2.7 | Function `Mark-PluginQuarantined -PluginId <id> -Reason <reason>` exists + works | `Mark-PluginQuarantined` output | Tier 2 | ☐ PASS / ☐ FAIL |
| 2.8 | `Add-PluginToRegistry` fails (error) if plugin ID already exists | Error output test | Tier 2 | ☐ PASS / ☐ FAIL |
| 2.9 | Checksum generator created at `skills/toolforge-registry-manager/src/checksum.ps1` | File system | Tier 2 | ☐ PASS / ☐ FAIL |
| 2.10 | Function `Get-PluginChecksum -Path <path> -Algorithm SHA256` deterministic (same input → same output) | Two consecutive runs | Tier 2 | ☐ PASS / ☐ FAIL |
| 2.11 | Checksum format: `sha256-<hex>` (lowercase) | `Get-PluginChecksum` output | Tier 2 | ☐ PASS / ☐ FAIL |
| 2.12 | Audit log created at `docs/toolforge/registry-audit.log` | File system | Tier 2 | ☐ PASS / ☐ FAIL |
| 2.13 | Audit log format: `TIMESTAMP | OPERATION | PLUGIN_ID | STATUS | DETAILS` | Log file content | Tier 2 | ☐ PASS / ☐ FAIL |
| 2.14 | All registry mutations tracked in git history (commits visible) | `git log docs/toolforge/registry.json` | Tier 2 | ☐ PASS / ☐ FAIL |

**Deliverable 2 Status:** ☐ COMPLETE (all 14 criteria PASS) / ☐ BLOCKED (list failures)

---

## Deliverable 3: CLI (list, install, submit)

| # | Criterion | Evidence Location | Verifier | Status |
|----|-----------|-------------------|----------|--------|
| 3.1 | CLI entry point created at `skills/toolforge-cli/src/cli.ps1` | File system | Tier 2 | ☐ PASS / ☐ FAIL |
| 3.2 | Function `Invoke-ToolforgeCli -Command <string> -Args <string[]>` exists + dispatches correctly | Function call test | Tier 2 | ☐ PASS / ☐ FAIL |
| 3.3 | Command `toolforge list` reads registry + outputs table (ID, Name, Version, Category, Status) | `toolforge list` output | Tier 2 | ☐ PASS / ☐ FAIL |
| 3.4 | Command `toolforge list --category <cat>` filters by category | `toolforge list --category monitoring` output | Tier 2 | ☐ PASS / ☐ FAIL |
| 3.5 | Command `toolforge list --status <status>` filters by status | `toolforge list --status published` output | Tier 2 | ☐ PASS / ☐ FAIL |
| 3.6 | Command `toolforge list --format json` outputs valid JSON | `toolforge list --format json \| ConvertFrom-Json` | Tier 2 | ☐ PASS / ☐ FAIL |
| 3.7 | Command `toolforge install <id>` looks up plugin in registry + installs | `toolforge install toolforge-drift-monitor` output | Tier 2 | ☐ PASS / ☐ FAIL |
| 3.8 | Command `toolforge install <id>` verifies checksum before installation | Installation log | Tier 2 | ☐ PASS / ☐ FAIL |
| 3.9 | Command `toolforge install <id>` fails (error, exit code 1) if plugin not found | Error message test | Tier 2 | ☐ PASS / ☐ FAIL |
| 3.10 | Command `toolforge install <id>` fails if plugin quarantined | Error message test | Tier 2 | ☐ PASS / ☐ FAIL |
| 3.11 | Installed plugins stored in `~/.toolforge/skills/<id>` | Directory structure | Tier 2 | ☐ PASS / ☐ FAIL |
| 3.12 | Command `toolforge submit <path>` validates skill + generates conformance report | `toolforge submit ./skills/toolforge-drift-monitor` output | Tier 2 | ☐ PASS / ☐ FAIL |
| 3.13 | Command `toolforge submit <path> --dry-run` validates without creating submission | `--dry-run` test output | Tier 2 | ☐ PASS / ☐ FAIL |
| 3.14 | All commands deterministic (same inputs → same output) | Multiple runs, same args | Tier 2 | ☐ PASS / ☐ FAIL |
| 3.15 | All commands have `--help` text | `toolforge list --help` output | Tier 2 | ☐ PASS / ☐ FAIL |

**Deliverable 3 Status:** ☐ COMPLETE (all 15 criteria PASS) / ☐ BLOCKED (list failures)

---

## Deliverable 4: Submission Validator

| # | Criterion | Evidence Location | Verifier | Status |
|----|-----------|-------------------|----------|--------|
| 4.1 | Validator entry point created at `skills/toolforge-submission-validator/src/validate.ts` | File system | Tier 2 | ☐ PASS / ☐ FAIL |
| 4.2 | Function `validateSubmission(skillPath)` exists + runs all 5 checks | Function call test | Tier 2 | ☐ PASS / ☐ FAIL |
| 4.3 | Check 1: `checkManifestValid` detects missing SKILL.json | Test output | Tier 2 | ☐ PASS / ☐ FAIL |
| 4.4 | Check 1: `checkManifestValid` detects invalid semver in version field | Test output | Tier 2 | ☐ PASS / ☐ FAIL |
| 4.5 | Check 2: `checkTestsPass` runs tests (npm test / Invoke-Pester) | Test output | Tier 2 | ☐ PASS / ☐ FAIL |
| 4.6 | Check 2: `checkTestsPass` reports coverage (if available) | Test output | Tier 2 | ☐ PASS / ☐ FAIL |
| 4.7 | Check 3: `checkDocsComplete` detects missing README | Test output | Tier 2 | ☐ PASS / ☐ FAIL |
| 4.8 | Check 3: `checkDocsComplete` detects missing "Usage" section | Test output | Tier 2 | ☐ PASS / ☐ FAIL |
| 4.9 | Check 4: `checkGovernanceAligned` detects naming violations (not `<scope>-<function>` pattern) | Test output | Tier 2 | ☐ PASS / ☐ FAIL |
| 4.10 | Check 4: `checkGovernanceAligned` detects >70% code duplication with existing skills | Test output | Tier 2 | ☐ PASS / ☐ FAIL |
| 4.11 | Check 5: `checkCavemanReview` always pending (manual step) | Test output | Tier 2 | ☐ PASS / ☐ FAIL |
| 4.12 | Conformance report generated (JSON file + human stdout) | Report file + console | Tier 2 | ☐ PASS / ☐ FAIL |
| 4.13 | Report contains submission ID, skill ID, timestamp, status, all 5 checks | Report JSON | Tier 2 | ☐ PASS / ☐ FAIL |
| 4.14 | Blockers list includes "Caveman review pending" | Report `blockers` field | Tier 2 | ☐ PASS / ☐ FAIL |
| 4.15 | Validator contains zero code execution (no eval, exec, or dynamic calls) | Code review | Tier 1 | ☐ PASS / ☐ FAIL |

**Deliverable 4 Status:** ☐ COMPLETE (all 15 criteria PASS) / ☐ BLOCKED (list failures)

---

## Cross-Deliverable Integration

| # | Criterion | Evidence Location | Verifier | Status |
|----|-----------|-------------------|----------|--------|
| 5.1 | CLI calls Validator correctly (`toolforge submit` → `validateSubmission`) | Code review + test | Tier 2 | ☐ PASS / ☐ FAIL |
| 5.2 | Validator writes to Registry (approved submissions update registry.json) | Registry file + audit log | Tier 2 | ☐ PASS / ☐ FAIL |
| 5.3 | All 4 deliverables integrated into single workflow (submit → validate → approve → publish) | End-to-end test | Tier 2 | ☐ PASS / ☐ FAIL |
| 5.4 | CLAUDE.md updated with Toolforge Marketplace decision + publication workflow | `CLAUDE.md` content | Tier 1 | ☐ PASS / ☐ FAIL |
| 5.5 | Zero safety violations (conformance gate enforced, manual Tier 1 review required) | Code + governance review | Tier 1 | ☐ PASS / ☐ FAIL |

**Integration Status:** ☐ COMPLETE (all 5 criteria PASS) / ☐ BLOCKED (list failures)

---

## Phase Gate Approval

**Phase 8 Wave D Mission Summary:**

| Item | Status | Evidence |
|------|--------|----------|
| **Manifest Schema** | ☐ PASS / ☐ FAIL | 14/14 criteria |
| **Registry Service** | ☐ PASS / ☐ FAIL | 14/14 criteria |
| **CLI** | ☐ PASS / ☐ FAIL | 15/15 criteria |
| **Validator** | ☐ PASS / ☐ FAIL | 15/15 criteria |
| **Integration** | ☐ PASS / ☐ FAIL | 5/5 criteria |
| **Total** | ☐ PASS (54/54) / ☐ FAIL | List blocked criteria |

**Tier 1 Decision Required:**
- ☐ APPROVE (all 54 criteria pass) → Phase 8 Wave D LOCKED, proceed to Phase 9
- ☐ REQUEST CHANGES (list blocked criteria) → Tier 2 fixes, resubmit
- ☐ REJECT (safety concerns) → return to design phase

**Approval Date:** ________________  
**Tier 1 Signature:** ________________  
**Phase 8 Wave D Status:** ☐ SHIPPED / ☐ BLOCKED / ☐ REJECTED

---

**End of Checklist**

Use this checklist to verify phase completion. Each ☐ PASS / ☐ FAIL must be manually checked + signed off by Tier 2 (implementation) and Tier 1 (approval).
