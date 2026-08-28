# Documentation publishing and governance implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Establish one canonical documentation source with synchronized MkDocs and GitHub Wiki publication, automated rendered QA, and freshness governance.

**Architecture:** Build a canonical inventory and validators first, then repair and strictly build MkDocs, then refactor Wiki publication to consume the inventory. Add PR and post-publication workflows only after local validation is deterministic.

**Spec:** `docs/superpowers/specs/2026-08-27-documentation-publishing-governance-design.md`

## Execution sequence

### Phase 1: Establish the source contract

1. Inventory every file currently referenced by `mkdocs.yml`, `scripts/sync-github-wiki.mjs`, `tools/wiki-browser-qa/diagram-policy.json`, and Wiki sidebar mappings.
2. Decide the disposition of each missing MkDocs target: restore, rename with reference migration, remove from navigation, or classify as external/archive.
3. Add the canonical publication inventory and schema.
4. Add unit tests for missing sources, duplicate destinations, invalid classifications, and missing owners.
5. Add a validator command and make it pass against the cleaned inventory.

### Phase 2: Repair and validate MkDocs

1. Align `mkdocs.yml` navigation with the actual canonical files.
2. Add `site_url`, schema validation, and locked Python dependencies.
3. Add a strict-build workflow for documentation changes and pull requests.
4. Add internal-link validation against the generated site.
5. Verify the build from a clean checkout.

### Phase 3: Make Wiki publication manifest-driven

1. Replace hard-coded publication lists with inventory-driven selection while preserving deliberate Wiki-only exceptions.
2. Change local behavior to dry-run unless `--push` is explicitly supplied.
3. Emit copied/skipped/missing manifests.
4. Validate generated sidebar links against the inventory.
5. Add tests for exact source-to-destination mappings, archive exclusions, image validation, and dry-run safety.

### Phase 4: Add rendered QA gates

1. Run local Wiki materialization in CI.
2. Serve the generated mirror and run `npm run wiki:qa` against it.
3. Keep the existing scoped link and diagram evidence checks as required gates.
4. Add post-publication live QA with retained JSON reports.
5. Add the weekly five-artifact audit output to the documentation operations record.

### Phase 5: Harden workflows and freshness

1. Pin all third-party actions to full commit SHAs.
2. Apply least-privilege permissions and publication concurrency controls.
3. Add freshness metadata and a scheduled stale-document report.
4. Document ownership, exceptions, publication, rollback, and incident handling.
5. Run a full clean-checkout acceptance pass and record the results.

## Effort estimate

| Area | Estimate |
| --- | ---: |
| Inventory and source reconciliation | 1–2 days |
| MkDocs repair and strict CI | 1 day |
| Manifest-driven Wiki publisher | 1–2 days |
| Local/live rendered QA workflows | 1–2 days |
| Security, freshness, and operational docs | 1 day |

## Definition of done

1. The design spec acceptance criteria all pass.
2. A clean checkout builds MkDocs strictly without missing navigation targets.
3. A clean checkout materializes the Wiki deterministically without pushing by default.
4. PR CI validates source files and local rendered output.
5. Post-publication QA retains a report and fails visibly when the live Wiki regresses.
6. All documentation owners, exceptions, and freshness results are machine-checkable.
