# Skill Migration Roadmap

**Version:** 1.0  
**Status:** Planning  
**Owner:** Governance  
**Target:** Complete by end of Phase 9

## Purpose

Migrate 35 existing skills from custom README structures → standardized Skill Operator Guide template. Eliminates 105–175 boilerplate lines + enables consistent agent scanning.

## Migration Criteria

Each skill needs:

1. **README.md** → < 100 lines (pitch + quick start + links to guide)
2. **SKILL.md** → < 150 lines (frontmatter + trigger + schemas)
3. **docs/USAGE.md** → If workflow > 3 steps (examples, troubleshooting)
4. **Pass compliance validator**: `.\utilities\skill-doc-validator.ps1 -Path skills/[skill-name]`

## Priority Tiers

### Tier 1 (High visibility, ship-blockers)
- `kb-sync-nightly` — Automated pipeline (critical path)
- `obsidian-ingest-wiki` — Active ingest tool
- `work-summarizer` — Daily reports (internal facing)
- `skill-security-auditor` — Security gate blocker
- `toolforge-drift-monitor` — Governance automation

**Why:** Public-facing, high-traffic skills. Template adoption improves discoverability.

### Tier 2 (Medium priority, toolforge-eligible)
- `kb-sync-artifact-generator` — Paired with kb-sync-nightly
- `analyze-token-burn` — Analytics
- `roadmap-validator` — Spec tooling
- `ashfall` — Phase automation
- `cic-ingest-world`, `cic-consolidate-artifacts`, `cic-run-gate`, `cic-repair-pipeline` — CIC pipeline
- `rollback-phase`, `scale-ingestion-service`, `reconcile-vector-store` — Phase utilities

**Why:** Toolforge candidates. Need clean docs for publication.

### Tier 3 (Lower priority, can defer)
- Remaining 12 skills (experimental, internal-use only)

## Migration Steps Per Skill

1. Read current README.md + SKILL.md + any docs/
2. Extract:
   - Unique pitch (copy to new README)
   - Trigger text (copy to new SKILL.md)
   - Input/output schema (move to SKILL.md types)
   - Setup/requirements (link to Skill Operator Guide)
   - Custom workflow (extract to docs/USAGE.md if needed)
3. Update README.md:
   - Title + pitch (1–2 lines)
   - Quick start (copy-paste trigger)
   - What it does (2–3 bullets)
   - Links to guide + SKILL.md
4. Create SKILL.md:
   - Frontmatter (name, description, compatibility)
   - Trigger section (exact invocation)
   - Input schema (types only, 15 lines max)
   - Output schema (types only, 15 lines max)
   - Error table (if unique errors; else link to guide)
5. Run validator: `.\utilities\skill-doc-validator.ps1 -Path skills/[skill-name]`
6. Commit with message: `docs: migrate [skill-name] to Skill Operator Guide template`

## Expected Savings

| Metric | Current | Post-Migration |
|--------|---------|-----------------|
| Total README lines (35 skills) | ~3,500 | ~2,000 (43% reduction) |
| Duplicate sections | — | 0 (consolidated in guide) |
| Boilerplate per skill | 20–40 lines | 0 (linked, not repeated) |
| Discovery-time (agent scan) | 1,170 .md files | ~1,050 (10% reduction) |
| Token waste (boilerplate) | ~12–18 KB/session | ~5–8 KB/session |

## Timeline

- **Week 1 (2026-07-21):** Tier 1 (5 skills)
- **Week 2 (2026-07-28):** Tier 2a (7 skills)
- **Week 3 (2026-08-04):** Tier 2b (5 skills)
- **Week 4+ (2026-08-11):** Tier 3 (12 skills, parallel with other work)

## Validation

**Pre-merge checklist:**

- [ ] README.md < 100 lines
- [ ] SKILL.md < 150 lines
- [ ] Both reference Skill Operator Guide
- [ ] Validator pass: 0 errors
- [ ] Caveman review: No duplicate sections, no narrative in schemas
- [ ] Tests still pass (if skill has tests)

**Metrics post-completion:**

- Measure post-migration agent discovery-time
- Compare vs. baseline (1,170 .md files)
- Verify no broken skill invocations

## Related

- `docs/meta/skill-operator-guide.md` — Canonical template
- `skills/_TEMPLATE/` — Reference implementation
- `utilities/skill-doc-validator.ps1` — Compliance checker
- `docs/meta/context-index-policy.md` — Agent context optimization

