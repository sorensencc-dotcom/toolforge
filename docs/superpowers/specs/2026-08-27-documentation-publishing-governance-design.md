# Documentation publishing and governance design

## Goal

Make `docs/` the canonical documentation source, publish consistent MkDocs and GitHub Wiki outputs, and enforce source, navigation, rendering, security, and freshness checks in CI.

## Current state

- `mkdocs.yml` declares `docs/` as its source, but its navigation references paths that do not exist in the current tree. A repository audit found 64 missing targets among 70 parsed navigation entries.
- No GitHub Actions workflow builds or deploys MkDocs.
- `scripts/sync-github-wiki.mjs` publishes selected root files plus `docs/` and `wiki/` trees to `toolforge.wiki.git`, and generates a separate Wiki sidebar.
- Wiki publishing is not represented by a dedicated workflow and the publisher currently defaults to pushing because `shouldPush` ends with `|| true`.
- `tools/wiki-browser-qa/` provides deterministic browser QA and live-browser adapters, but no CI workflow invokes it.
- Workflow action references mix floating tags and commit SHAs.

## Decisions

1. `docs/` is canonical for MkDocs documentation and all pages intentionally mirrored to the GitHub Wiki.
2. `wiki/` remains a source area only for GitHub-Wiki-specific rendered diagrams or pages that cannot be represented in MkDocs; each exception requires an explicit manifest entry.
3. MkDocs/GitHub Pages is the primary navigable documentation surface. GitHub Wiki remains a compatibility and operational mirror.
4. Pull requests run source validation, strict MkDocs build, navigation checks, and local rendered Wiki QA. Live Wiki QA runs after a permitted publication and on a scheduled audit.
5. Wiki publication requires an explicit workflow dispatch or an approved push-to-main publication job; local commands must default to dry-run/no-push.
6. Documentation changes require a named owner and freshness metadata in the documentation inventory, not ad hoc dates embedded in every page.

## Architecture

```text
docs/ + mkdocs.yml + wiki publication manifest
        |
        +--> source/link/image validation
        +--> mkdocs build --strict --> GitHub Pages
        +--> Wiki materializer ----------> toolforge.wiki.git
        +--> local rendered QA ----------> PR gate
        +--> live Wiki QA ---------------> post-publish/scheduled audit
```

## Required components

### Canonical inventory

Create a version-controlled inventory containing, for every published document:

- canonical source path;
- MkDocs path and navigation label;
- Wiki destination path, when mirrored;
- owner;
- classification (`public`, `internal`, or `archive`);
- publication status;
- allowed assets and source mappings;
- freshness review interval.

The validator must fail when a published entry references a missing source, duplicate destination, missing owner, or unsupported classification.

### MkDocs build

- Repair `mkdocs.yml` navigation to match actual files or move files deliberately with reference updates.
- Add explicit `site_url` for the deployed site.
- Add reproducible Python dependency files and CI installation.
- Run `mkdocs build --strict` on documentation pull requests.
- Treat missing navigation targets, malformed configuration, and unresolved internal links as failures.

### GitHub Wiki publication

- Materialize from the inventory rather than independent hard-coded lists.
- Preserve frontmatter normalization and local image validation.
- Make push behavior explicit: `--push` or workflow-controlled publication only.
- Produce a manifest of copied, skipped, and missing files.
- Run source checks before commit and push.
- Upload the materialization manifest and QA report as workflow artifacts.

### Navigation consistency

Compare the MkDocs navigation, Wiki sidebar, and inventory. Fail on missing destinations, duplicate labels, or links that point to a different canonical page than the inventory declares.

### Rendered QA

- Run `npm run wiki:qa` against a local generated mirror in pull requests.
- Run live Wiki QA after publication and on a weekly schedule.
- Keep link scope restricted to documentation paths; report platform chrome separately.
- Require diagram evidence, alternative text, captions, successful image dimensions, and desktop/mobile visibility.

### Workflow security

- Pin every third-party GitHub Action to a full commit SHA.
- Set least-privilege job permissions.
- Use concurrency cancellation for preview validation and serialized publication for Wiki pushes.
- Never place credentials, cookies, or request headers in QA reports.

## Acceptance criteria

1. `mkdocs build --strict` passes from a clean checkout.
2. Every declared MkDocs navigation target resolves to exactly one file.
3. Every Wiki destination is generated from the canonical inventory or explicitly marked Wiki-only.
4. A dry-run Wiki materialization exits non-zero for missing source files, broken local images, duplicate destinations, or invalid sidebar links.
5. A local Wiki mirror passes `npm run wiki:qa` in CI without live credentials.
6. A post-publication workflow runs live Wiki QA and uploads its JSON report on success or failure.
7. GOVERNANCE and all policy-required diagram pages pass desktop and mobile evidence checks.
8. No workflow uses an unpinned third-party action reference.
9. A freshness audit reports every published page whose review interval has elapsed.
10. The canonical source, publication commands, ownership model, rollback procedure, and exception process are documented.

## Testing strategy

| Layer | Scope |
| --- | --- |
| Unit | Inventory schema, path resolution, navigation comparison, freshness calculation, publication filtering |
| Integration | Clean checkout MkDocs strict build; Wiki materialization; source image/link validation |
| Rendered | Local mirror browser QA, diagram evidence, mobile overflow, accessibility, scoped links |
| Workflow | Pull request validation, publication permissions, artifact upload, concurrency, SHA policy |
| Live | Scheduled/post-publish GitHub Wiki audit with failure artifact retention |

## Rollback

Revert the documentation source or inventory commit, rerun the materializer, and publish the resulting Wiki commit. GitHub Pages rollback uses the prior successful deployment. QA and validation changes are reverted independently from content changes.

## Out of scope

- Automatic repair of documentation content.
- Replacing GitHub Wiki with a new documentation platform.
- Provider/API smoke tests.
- Screenshot-diff baselines.
