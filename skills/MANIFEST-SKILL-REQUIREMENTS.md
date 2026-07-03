# Manifest Skill Requirements

**Target**: `C:\dev\toolforge\manifest.json`  
**Generated**: 2026-06-28  
**Status**: Skill support planned (not yet implemented)

---

## Current State

### Manifest Analysis

**File**: `C:\dev\toolforge\manifest.json`  
**Version**: 1.0.0  
**Last Updated**: 2026-06-28T16:30:00Z

**Current Structure**:
```json
{
  "version": "1.0.0",
  "generated": "2026-06-28T16:30:00Z",
  "tools": [
    {
      "name": "toolName",
      "category": "sync-tools|daemons|utilities|adapters|mcp-servers|...",
      "path": "C:/dev/toolforge/category/toolName",
      "description": "...",
      "entrypoint": "...",
      "status": "active|inactive|deprecated",
      "version": "0.1.0",
      "owner": "...",
      "tags": ["..."],
      "dependencies": ["..."],
      "schedule": "..." // optional
    }
  ]
}
```

**Current Fields**:
- ✓ `version` — Manifest schema version (1.0.0)
- ✓ `generated` — ISO 8601 timestamp
- ✓ `tools` — Array of tools (all categories)

**Missing Fields** (for skills support):
- ✗ `skills` — Skill registry array
- ✗ `skillpack` — Skillpack metadata
- ✗ `skillRegistry` — Skill index
- ✗ `skillDependencies` — Skill dependency graph

### Current Tool Categories

Tools are registered in `tools` array with categories:

| Category | Count | Examples |
|----------|-------|----------|
| sync-tools | 1 | multiRepoRoadmapSync |
| daemons | 3 | toolforgeManifestSync, toolforgeDocsSync, toolforgeIndexSync |
| utilities | 1 | setupTaskScheduler |
| adapters | 0 | (none yet) |
| mcp-servers | 0 | (none yet) |
| scaffolds | 0 | (none yet) |
| prototypes | 0 | (none yet) |
| **skills** | 0 | (not yet integrated) |

**Finding**: Manifest does **NOT** currently expect skills directory.

---

## Future State: Skill Support

### Recommended Manifest Extension

**Phase 1**: Add `skills` array to manifest

```json
{
  "version": "1.0.0",
  "generated": "2026-06-28T16:30:00Z",
  "tools": [
    // existing tools...
  ],
  "skills": [
    {
      "id": "unique-skill-id",
      "name": "Skill Display Name",
      "category": "automation|analysis|integration|validation|generation|transformation|management|monitoring|documentation|security",
      "path": "C:/dev/toolforge/skills/skill-name",
      "description": "Single-line purpose statement",
      "entrypoint": "skills/skill-name/src/index.ts",
      "status": "active|inactive|deprecated",
      "version": "0.1.0",
      "owner": "author-name",
      "tags": ["tag1", "tag2"],
      "runtime": "typescript|javascript|powershell|python|bash",
      "timeout": 30000,
      "permissions": {
        "required": ["read:repo"],
        "optional": ["write:file"]
      },
      "dependencies": {
        "internal": [],
        "external": []
      },
      "inputs": [
        {
          "name": "input1",
          "type": "string",
          "required": true
        }
      ],
      "outputs": {
        "success": "object",
        "error": "object"
      },
      "integrations": {
        "cic": false,
        "distributed": true
      }
    }
  ]
}
```

### Phase 2: Add Skillpack Metadata

```json
{
  "version": "1.1.0",
  "generated": "2026-06-28T16:30:00Z",
  "skillpack": {
    "version": "0.1.0",
    "lastUpdated": "2026-06-28T16:30:00Z",
    "totalSkills": 0,
    "activeSkills": 0,
    "deprecated": []
  },
  "tools": [...],
  "skills": [...]
}
```

### Phase 3: Add Dependency Validation

```json
{
  "version": "1.2.0",
  "skillDependencies": {
    "skill-name-1": {
      "requires": [],
      "requiredBy": []
    }
  },
  "skillRegistry": {
    "byCategory": { ... },
    "byRuntime": { ... },
    "byPermission": { ... }
  }
}
```

---

## Required Skill Fields

### Mandatory Fields (Tier 1)

Every skill **MUST** have:

- **id** (string, kebab-case)
  - Unique identifier
  - Pattern: `^[a-z0-9]([a-z0-9-]*[a-z0-9])?$`
  - Length: 3-50 chars
  - Example: `cost-analyzer`

- **name** (string)
  - Display name
  - Length: 1-100 chars
  - Example: `Cost Analyzer`

- **category** (enum)
  - Functional category
  - Values: automation, analysis, integration, validation, generation, transformation, management, monitoring, documentation, security
  - Example: `automation`

- **path** (string)
  - Full path to skill directory
  - Must exist: `C:/dev/toolforge/skills/<id>/`
  - Example: `C:/dev/toolforge/skills/cost-analyzer`

- **description** (string)
  - Single-line purpose
  - Length: 10-200 chars
  - Example: `Analyze project costs across all repos`

- **entrypoint** (string)
  - Entry point file
  - Relative to skill path
  - Example: `src/index.ts`

- **status** (enum)
  - active | inactive | deprecated
  - Example: `active`

- **version** (string)
  - Semantic version (X.Y.Z)
  - Example: `0.1.0`

- **owner** (string)
  - Creator or maintainer
  - Example: `soren`

### Essential Fields (Tier 2)

Highly recommended:

- **tags** (array of strings)
  - Categorization tags
  - 1-5 tags recommended
  - Example: `["automation", "cost", "analysis"]`

- **runtime** (enum)
  - typescript | javascript | powershell | python | bash
  - Must match entrypoint file
  - Example: `typescript`

- **timeout** (number, milliseconds)
  - Max execution time
  - Default: 30000 (30s)
  - Example: `60000`

- **permissions** (object)
  - `required` (array): Minimum capabilities
  - `optional` (array): Additional capabilities
  - Example: `{ "required": ["read:repo"], "optional": ["write:file"] }`

### Contextual Fields (Tier 3)

Conditional on skill type:

- **schedule** (string)
  - For scheduled skills only
  - Format: human-readable or cron
  - Example: `Daily 09:00 UTC`

- **inputs** (array)
  - For parameterized skills
  - Each input: name, type, required, description
  - Example: `[{ "name": "repo", "type": "string", "required": true }]`

- **outputs** (object)
  - For data-producing skills
  - `success` and `error` shapes
  - Example: `{ "success": "object", "error": "object" }`

- **dependencies** (object)
  - `internal`: Skills this depends on
  - `external`: External libraries/services
  - Example: `{ "internal": [], "external": ["Node.js 20+"] }`

---

## Validation Rules

### Required Directory Structure

Each skill in manifest must have:

```
C:\dev\toolforge\skills\<skill-id>/
├── skill.json              ✓ REQUIRED
├── README.md               ✓ REQUIRED
├── src/
│   └── index.ts|js|py|ps1  ✓ REQUIRED (matches runtime)
├── tests/
│   └── *.test.ts|js|py     ✓ REQUIRED
└── docs/
    └── USAGE.md            ✓ REQUIRED
```

**Validation**:
- [ ] Path exists: `C:/dev/toolforge/skills/<id>/`
- [ ] skill.json exists and is valid JSON
- [ ] README.md exists and is readable
- [ ] src/ directory exists with entrypoint
- [ ] tests/ directory exists with test file(s)
- [ ] docs/ directory exists with USAGE.md

### File Content Validation

**skill.json** must contain:
- Valid JSON (no syntax errors)
- All Tier 1 mandatory fields
- No extra fields outside known schema
- No circular dependencies
- Unique skill ID across manifest

**Entrypoint** must:
- Match file type in runtime
- Export default function (TypeScript/JavaScript)
- Accept input matching `inputs` schema
- Return output matching `outputs` schema

**Tests** must:
- Be valid test syntax for runtime
- Cover happy path
- Cover error conditions
- Pass before registration

**Docs** must:
- Be valid Markdown
- Include all required sections:
  - Purpose
  - Inputs (with examples)
  - Outputs (with examples)
  - Error codes
  - Permissions
  - Examples
  - Related skills

### Manifest Validation

**When manifest.json is updated**:

- [ ] JSON is valid (can parse)
- [ ] All skills have required fields
- [ ] All skill paths exist
- [ ] All skill IDs are unique
- [ ] All skill versions are semantic (X.Y.Z)
- [ ] All skill categories are valid enum values
- [ ] All skill runtimes are valid enum values
- [ ] All skill statuses are valid enum values
- [ ] No circular dependencies between skills
- [ ] All internal dependencies exist
- [ ] All external dependencies are documented

### Cross-Repo Validation (Distributed Sync)

When skill is registered in canonical manifest:

- [ ] Skill exists in canonical: `C:\dev\toolforge\skills\<id>/`
- [ ] Skill exists in distributed: `C:\dev\rewrite-mcp\toolforge\skills\<id>/`
- [ ] skill.json versions match
- [ ] All files synced correctly
- [ ] Manifest entry in distributed is identical
- [ ] No conflicts with distributed-specific skills

---

## Integration Checklist

### Before Adding Skill to Manifest

**Step 1: Verify Structure**
- [ ] Skill directory exists
- [ ] All required files present
- [ ] skill.json is valid JSON
- [ ] Files readable and not corrupt

**Step 2: Validate Content**
- [ ] skill.json has all Tier 1 fields
- [ ] Entrypoint file matches runtime
- [ ] Tests pass: `npm test`
- [ ] Documentation complete

**Step 3: Check Dependencies**
- [ ] All internal skills exist
- [ ] All external deps documented
- [ ] No circular dependencies
- [ ] Version compatibility verified

**Step 4: Register in Manifest**
- [ ] Add skill entry to `manifest.json`
- [ ] Ensure ID is unique
- [ ] Validate manifest JSON
- [ ] Commit to git

**Step 5: Synchronize**
- [ ] Sync to distributed Toolforge
- [ ] Verify distributed has skill
- [ ] Validate distributed manifest
- [ ] Commit to distributed repo

**Step 6: Document**
- [ ] Create docs/skills/<skill-id>.md
- [ ] Update docs/SKILLS-INDEX.md
- [ ] Update CHANGELOG.md
- [ ] Update README.md

---

## Manifest Evolution Timeline

### v1.0.0 (Current: 2026-06-28)
- ✓ `tools` array with 5 tools
- ✓ Tool metadata schema
- ✗ Skills not yet supported

### v1.1.0 (Phase 0.2: Planned)
- ✓ Add `skills` array
- ✓ Skill metadata schema (Tier 1 + 2)
- ✓ toolforgeSkillValidator daemon
- ✓ First skill implementation

### v1.2.0 (Phase 1: Future)
- ✓ Add `skillpack` metadata
- ✓ Add `skillRegistry` (indexed by category/runtime/permission)
- ✓ Add `skillDependencies` (dependency graph)
- ✓ Advanced validation

### v2.0.0 (Future)
- ✓ Schema redesign (if needed)
- ✓ Breaking changes
- ✓ New capabilities

---

## Related Documents

- [SKILLPACK-VALIDATION.md](SKILLPACK-VALIDATION.md) — Full validation framework
- [SYNC-RECOMMENDATIONS.md](SYNC-RECOMMENDATIONS.md) — Sync policy
- [README.md](README.md) — Skillpack overview
- [_TEMPLATE/skill.json](_TEMPLATE/skill.json) — Metadata template
- [../../manifest.json](../../manifest.json) — Current manifest
- [../../GOVERNANCE.md](../../GOVERNANCE.md) — Standards

---

## Sign-Off

**Analysis Date**: 2026-06-28  
**Analyzed By**: Manifest Skill Requirement Engine  
**Current Status**: ✓ No changes needed (manifest correct for current phase)

**Next Action**: Extend manifest when first skill is created (Phase 0.2)  
**Recommendation**: Follow Phase 1 extension structure when adding skills  

---
