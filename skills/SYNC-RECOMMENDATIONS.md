# Toolforge Skills Sync Recommendations

**Generated**: 2026-06-28  
**Canonical**: `C:\dev\toolforge\skills\`  
**User-Local**: `C:\Users\soren\.claude\skills\`  
**Status**: No immediate sync required

---

## Executive Summary

**Comparison Result**: No skill implementations to sync

- **Canonical Toolforge**: 0 implementations (framework only)
- **User-Local**: 0 skill implementations (contributions only)
- **Difference**: 0 (none)
- **Recommendation**: Establish forward-sync policy for future skills

---

## Detailed Analysis

### User-Local Skills Directory

**Location**: `C:\Users\soren\.claude\skills\`

**Contents**:
```
C:\Users\soren\.claude\skills\
├── contributions/
│   └── fewer-permission-prompts-42.json    # Upstream PR tracking
├── artifact-sync-to-onedrive.md            # Artifact file (not a skill)
├── [backup files]                          # .bak files (not skills)
└── [other markdown files]                  # Documentation (not skills)
```

**File Breakdown**:
- Skill implementations: 0
- Contribution tracking files: 1
- Artifact/backup files: ~40
- Skill directories: 0

**Conclusion**: User-local directory contains **no actual skill implementations** — it's a contribution and artifact tracking location.

### Canonical Toolforge Skills Directory

**Location**: `C:\dev\toolforge\skills\`

**Contents**:
```
C:\dev\toolforge\skills\
├── _TEMPLATE/                              # Skill scaffold (framework)
├── SKILLPACK-VALIDATION.md                 # Validation framework
├── README.md                               # Skillpack overview
└── [no other skills]
```

**File Breakdown**:
- Skill implementations: 0
- Framework documentation: 3 files
- Template scaffold: 1 directory

**Conclusion**: Canonical has **no actual skill implementations** — only framework and template.

### Comparison Matrix

| Item | User-Local | Canonical | Status | Action |
|------|-----------|-----------|--------|--------|
| Skill implementations | 0 | 0 | ✓ Aligned | None |
| Framework docs | 0 | 3 | ⚠ One-way | Canonical lead |
| Template scaffold | 0 | 1 | ⚠ One-way | Canonical lead |
| Contribution tracking | 1 | 0 | Info only | Local only |
| Version mismatches | N/A | N/A | ✓ N/A | None |
| Metadata mismatches | N/A | N/A | ✓ N/A | None |

---

## Sync Policy Recommendation

### Current Phase: Framework Definition (0.1)

**Policy**: No sync required (no implementations yet)

**Rationale**:
- User-local directory serves as **contribution tracker** (upstream PR tracking)
- Canonical directory serves as **implementation repository** (skill definitions)
- These are separate concerns with different lifecycles
- Framework is new (created 2026-06-28)

### Future Phase: Skill Implementation (0.2+)

**Policy**: Forward-sync only (canonical → user-local)

**Direction**: Canonical Toolforge → User-Local (~/.claude/skills/)

**Why Forward-Sync**:
1. Canonical is source of truth for Toolforge skills
2. User-local is personal tools directory (separate concern)
3. Avoid conflicts between Toolforge and personal skills
4. Maintain clear separation of concerns

**Sync Rules** (when skills exist):
- Copy skill implementations from `C:\dev\toolforge\skills\<name>` to `C:\Users\soren\.claude\skills\<name>`
- Sync on-demand (not automatic)
- Do NOT sync back to canonical (user-local is working directory)
- User-local changes are working copies, not canonical

### Contributing Skills Back to Toolforge

**Process** (when user creates new skill):

1. **Create in user-local** (experimental):
   ```
   C:\Users\soren\.claude\skills\my-new-skill/
   ├── skill.json
   ├── src/
   ├── tests/
   └── docs/
   ```

2. **Validate locally**:
   - Pass all tests
   - Follow SKILLPACK-VALIDATION.md
   - Complete documentation

3. **Proposal to canonical**:
   - Copy to `C:\dev\toolforge\skills\my-new-skill/`
   - Create PR or commit with rationale
   - Request review

4. **Integration to canonical**:
   - Register in canonical `manifest.json`
   - Sync to distributed instances
   - Generate integration docs

---

## Contribution Tracking

### Current Contribution

**File**: `C:\Users\soren\.claude\skills\contributions\fewer-permission-prompts-42.json`

**Details**:
- **Skill**: fewer-permission-prompts
- **PR**: #42 (upstream: github.com/anthropics/claude-skills)
- **Type**: perf-optimization
- **Status**: Open
- **Author**: soren

**Action**: Keep in user-local for tracking. Do not sync to canonical.

### Future Contributions

**Recommendation**: Maintain separate contributions/ directory for:
- Upstream Claude Skills PR tracking
- Integration status
- Pending feedback
- Version alignment with upstream

---

## Action Items

### Immediate (Now)

- [x] Create canonical skills/ directory
- [x] Create SKILLPACK-VALIDATION.md
- [x] Create _TEMPLATE/ scaffold
- [x] Create this sync recommendations doc
- [ ] Document in GOVERNANCE.md (user-local vs canonical split)

### Short-term (Phase 0.2)

- [ ] First skill creation (using _TEMPLATE/)
- [ ] Test sync process (manual copy)
- [ ] Validate manifest registration
- [ ] Update contribution tracking process

### Long-term (Phase 1+)

- [ ] Build toolforgeSkillSync daemon
- [ ] Automated forward-sync (canonical → distributed)
- [ ] Contribution workflow formalization
- [ ] Upstream integration automation

---

## Directory Purpose Summary

### `C:\Users\soren\.claude\skills\` (User-Local)

**Purpose**: Personal tools directory + contribution tracking

**Use cases**:
- Experimental skill development
- Testing and iteration
- Contribution tracking (upstream PRs)
- Personal automation scripts
- Artifacts and working files

**Sync direction**: ← (receive from canonical)
**Managed**: Manually
**Public**: No

### `C:\dev\toolforge\skills\` (Canonical)

**Purpose**: Canonical Toolforge skill repository

**Use cases**:
- Production skill implementations
- Framework standards
- Template scaffolding
- Distributed synchronization
- CIC integration

**Sync direction**: → (distribute to all)
**Managed**: Git-based
**Public**: Yes

---

## Related Documents

- [SKILLPACK-VALIDATION.md](SKILLPACK-VALIDATION.md) — Validation framework
- [README.md](README.md) — Skillpack overview
- [_TEMPLATE/](\_TEMPLATE/) — Skill scaffold
- [../../GOVERNANCE.md](../../GOVERNANCE.md) — Standards (to be updated)
- [../../manifest.json](../../manifest.json) — Skill registry

---

## Implementation Notes

### Why Separate Directories?

1. **Purpose Separation**
   - Canonical: Shared, production skills
   - User-local: Personal, experimental tools

2. **Lifecycle Difference**
   - Canonical: Stable, versioned, distributed
   - User-local: Volatile, working copies, contributions

3. **Governance**
   - Canonical: Strict validation, PR review, versioning
   - User-local: Ad-hoc development, immediate changes

4. **Sync Direction**
   - Canonical → Distributed: Automatic (broadcast)
   - Canonical ← User-local: Manual (pull request)
   - User-local ← Canonical: Manual (copy on demand)

### Sync Mechanics (When Implemented)

**Forward-Sync** (Canonical → User-Local):
```powershell
# Manual copy (for now)
Copy-Item -Path "C:\dev\toolforge\skills\skill-name" `
          -Destination "C:\Users\soren\.claude\skills\skill-name" `
          -Recurse -Force
```

**Contribution Process**:
```bash
# User creates skill in personal directory
# User tests and validates
# User copies to canonical for review
# Canonical validates and registers
# Canonical syncs to distributed
```

---

## Sign-Off

**Analysis Date**: 2026-06-28  
**Analyzed By**: Toolforge Sync Policy Engine  
**Status**: ✓ Complete

**Next Review**: When first skill is created in canonical (Phase 0.2)

**Policy**: Forward-sync recommended (canonical → distributed)  
**Implementation**: On-demand manual (daemon TBD for Phase 1)  

---
