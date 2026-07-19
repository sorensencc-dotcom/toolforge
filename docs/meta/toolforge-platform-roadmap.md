# Toolforge Roadmap

Evolution of the Toolforge platform: from foundation to marketplace with integrated topic research.

**Current Version**: 2.12.0 (2026-07-19)  
**Last Updated**: 2026-07-19

---

## Phase 1 — Foundation (✅ Complete, v2.0–2.5)

Core infrastructure and tool execution framework.

- ✅ Directory architecture (7 categories)
- ✅ Bootstrap + installer scripts
- ✅ Universal tool runner (`run-tool.ps1`)
- ✅ Manifest + metadata system
- ✅ 3 background daemons (manifest, docs, index sync)
- ✅ Windows Task Scheduler integration
- ✅ Governance framework (GOVERNANCE.md v2.0)

**Completed**: 2026-06-28 | **Status**: Stable, 5+ tools active

---

## Phase 2 — Operationalization (✅ Complete, v2.6–2.9)

Tooling, documentation, operator experience, and governance hardening.

**Completed**:

- ✅ Directory structure locked
- ✅ Tool discovery and auto-registration
- ✅ Manifest with extended metadata
- ✅ OPERATOR_GUIDE.md (full reference)
- ✅ TOOL_CREATION_GUIDE.md (onboarding)
- ✅ Governance rules documented (3-tier authority model)
- ✅ Skill documentation compliance (Skill Operator Guide template)
- ✅ Context Index Policy (token optimization, lockfile exclusions)
- ✅ CI/CD integration (GitHub Actions, pre-commit/pre-push hooks)
- ✅ Security auditor tool + governance-auditor agent
- ✅ Claude Code automation (hooks + skills + MCP wiring)

**Backlog (deferred to Phase 5)**:

- Dashboard v2 (tool status, execution history)
- Docs pipeline v2 (auto-generate per-tool docs)
- Release pipeline (version bump automation)
- Status badges (tool health)
- Error tracking and alerts

**Completed**: 2026-07-18 | **Status**: Stable

---

## Phase 3 — Topic Research Module (🟡 In Progress, v2.8–2.12)

Integrated document research, extraction, and topic management.

**Completed** (Design + Implementation Foundation):

- ✅ TRM design spec v1.0.0 (data model, API, extraction)
- ✅ TRM implementation plan (16 tasks, TDD, TypeScript/Jest/Commander)
- ✅ Claude Code extraction runner (5 task cycle, real PDF extraction)
- ✅ TRM data governance spec (category cardinality, slugification, orphan-ref handling)
- ✅ TRM reporting engine v1 spec + implementation plan
- ✅ TRM ingest --file spec (auto-conversion, error handling)
- ✅ PostgreSQL schema + migrations (full-text search, trigram indexes)
- ✅ TRM Harvester mock-wiring spec (real extraction pipeline design)

**In Progress**:

- 🟡 TRM real extraction runner (extraction + validation, TDD cycle)
- 🟡 TRM reporting engine v1 (output generation, metrics)
- 🟡 TRM Harvester real-vision migration (mock → live PDF parsing)

**Remaining** (Wave 3+):

- TRM topic cross-linking (resolve intra-topic + inter-topic references)
- TRM search API (full-text + semantic search)
- TRM analytics (research patterns, coverage gaps)
- TRM export (multiple formats: PDF, HTML, JSON)

**Target**: 2026-08-31 | **Status**: 60% complete (design + foundation layer done)

---

## Phase 4 — Marketplace (🟡 In Progress, v2.10–2.12)

API-driven skill discovery, installation, and distribution platform.

**Completed**:

- ✅ Express.js API server (Node.js 20+, ESM)
- ✅ PostgreSQL backend + migration system (`npm run migrate`)
- ✅ React 18 + Vite frontend
- ✅ CLI tool (`toolforge` command)
- ✅ Full test coverage (Node test runner, Vitest, Jest)
- ✅ E2E test harness + snapshot validation
- ✅ Load test suite (marketplace-load.js)
- ✅ Stress test suite (gate04-fairness.js)
- ✅ Trending batch service (npm run trending:refresh)
- ✅ Task Scheduler integration for recurring jobs

**In Progress**:

- 🟡 Marketplace API v1 (skill listing, filtering, discovery)
- 🟡 UI/UX for skill browsing + installation workflow
- 🟡 Skill validation pipeline + conformance checks
- 🟡 Analytics + telemetry (trending, usage metrics)

**Remaining** (Wave 2+):

- Skill dependency resolution
- Payment/billing integration
- Reviews + ratings system
- Author reputation score
- Search + recommendation engine
- Multi-language support
- Plugin marketplace (third-party integrations)

**Target**: 2026-09-30 | **Status**: 40% complete (API foundation + DB done, UI/discovery in progress)

---

## Phase 5 — Cloud Platform (📅 Future, 2027 Q1+)

Scale to multi-user, SaaS-hosted platform.

**Planned**:

- Cloud-hosted API (Docker, Kubernetes)
- Web dashboard (real-time tool execution, logs)
- Multi-tenancy (org-scoped tool namespaces)
- OAuth2 + RBAC (role-based access control)
- Audit logging + compliance (GDPR, SOC 2)
- Backup + disaster recovery
- Custom domain support
- Enterprise features (SSO, advanced analytics)

**Target**: 2027 Q1 | **Status**: Planned

---

## Current Blockers & Gaps

### Operational

- [ ] Blocker Prevention Infrastructure (2026-07-19 ✅ DONE)
  - Session-start checklist (codex CLI, network, git state)
  - Phase-gate git guard (detect race conditions)
  - Token budget gate (force /plan before large phases)

- [ ] Concurrent-Session Collision Recovery (In progress)
  - Git fetch + status before/after phase gates
  - Pre-phase-gate checklist (conflicts, detached HEAD)

### TRM (Phase 3)

- [ ] Real Extraction Runner — Swap mock PDF parser for production (pdf-parse + OCR pipeline)
- [ ] Cross-Topic References — Resolve intra-topic + inter-topic linkages
- [ ] Search API — Full-text + semantic search over extracted topics
- [ ] Reporting Engine v1 — Topic output generation (markdown, HTML, JSON)

### Marketplace (Phase 4)

- [ ] Skill Discovery API — Search, filter, and list skills with sorting
- [ ] Validation Pipeline — Conformance checks (manifest, tests, docs compliance)
- [ ] UI/UX Workflow — Skill browser, install buttons, confirmation dialogs
- [ ] Analytics — Trending score calculation, usage metrics collection
- [ ] Skill Dependency Resolution — Detect and install transitive skill dependencies

### Governance

- [ ] Multi-Repo Drift Detection — Extend validator to all repos under c:\dev
- [ ] Release Automation — Version bump + changelog + tag CI
- [ ] Dashboard v2 — Tool status, execution history, error alerts

---

## Milestones

| Phase | Target | Actual | Status |
| --- | --- | --- | --- |
| 1 — Foundation | 2026-06-28 | ✅ 2026-06-28 | Complete |
| 2a — Operationalization | 2026-07-15 | ✅ 2026-07-18 | Complete |
| 2b — Blocker Prevention | — | ✅ 2026-07-19 | Complete |
| 3a — TRM Foundation | 2026-07-31 | 🟡 In progress | 60% complete |
| 3b — TRM Reporting | 2026-08-15 | 📅 Planned | Not started |
| 4a — Marketplace Foundation | 2026-08-30 | 🟡 In progress | 40% complete |
| 4b — Marketplace UI | 2026-09-15 | 📅 Planned | Not started |
| 5 — Cloud Platform | 2027 Q1 | 📅 Future | Not started |

---

## Architecture Summary

### Core Services

#### Toolforge Marketplace

- Backend: Express.js API (Node.js 20+, ESM)
- Database: PostgreSQL (full-text search, trigram indexes)
- Frontend: React 18 + Vite
- CLI: Node.js command-line tool
- Testing: Node test runner + Vitest + Jest

#### Topic Research Module (TRM)

- PDF extraction: pdf-parse (production), OCR pipeline (planned)
- Data model: PostgreSQL schema with categories, topics, crosslinks
- Reporting: Markdown/HTML/JSON output generation
- Search: Full-text + semantic search (planned)

#### Governance Framework

- 3-tier authority model (Tier 1: decision, Tier 2: execution, Tier 3: automation)
- Skill documentation compliance (Skill Operator Guide template)
- Context Index Policy (token optimization)
- Security auditor + governance-auditor agent

---

## Contributing

See:
- [TOOL_CREATION_GUIDE.md](TOOL_CREATION_GUIDE.md) — Add new tools
- [GOVERNANCE.md](docs/meta/governance/global-operating-rules-cic-rewrite-labs.md) — Standards & review process
- [SKILL_OPERATOR_GUIDE.md](docs/meta/skill-operator-guide.md) — Skill documentation standards
- [.ijfw/BLOCKERS-README.md](.ijfw/BLOCKERS-README.md) — Environmental checklist & git safety

---

## Version History

- **v2.12.0** (2026-07-19) — Blocker prevention infrastructure (3 systems)
- **v2.11.1** (2026-07-19) — Skill migration Wave C + governance
- **v2.11.0** (2026-07-18) — Context Index Policy Wave B
- **v2.10.0** (2026-07-18) — Claude Code automation (hooks + skills + MCP)
- **v2.9.0** (2026-07-18) — TRM mock-wiring + CI-triage skill
- **v2.8.6** (2026-07-18) — TRM data governance spec
- **v2.8.0** (2026-07-17) — TRM design spec v1.0.0

See [CHANGELOG.md](CHANGELOG.md) for complete history.
