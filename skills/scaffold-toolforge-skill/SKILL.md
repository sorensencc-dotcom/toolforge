---
name: scaffold-toolforge-skill
description: Scaffold a new Toolforge skill with the correct structure, register it in manifest.json as a candidate, bump the pinned skill count, and run the repo validators. Use whenever the user says "new toolforge skill", "scaffold a skill", "create a skill", "add skill to manifest", or "register a skill", even if they only ask for the manifest entry.
compatibility: |
  - Runtime: Node.js 18+, PowerShell 7 (pwsh), Python 3
  - Dependencies: skills/_TEMPLATE, utilities/skill-doc-validator.ps1, utilities/toolforgeSkillValidator.ps1, utilities/skill-security-auditor.py
  - Permissions: read:repo, write:file
---

# Scaffold Toolforge skill

Hand-made skills drift: wrong layout, oversized docs, a manifest entry that never lands, a pinned count that breaks CI. One scripted path keeps all of these in step.

## Trigger

"new toolforge skill", "scaffold a skill", "add skill to manifest".

## Steps

1. **Check the id.** `validateSkillId(id, existingIds)` needs kebab-case, 3-48 chars, no duplicate. Existing ids come from `skills/` directory names and `manifest.json`.

2. **Check the branch.** Another session may be editing `manifest.json` and the integrity test. Run `git status --short` first and do not switch branches or stash.

3. **Scaffold.** `scaffoldSkill(repoRoot, { id, description, category, keywords, steps })` writes `skill.json`, `SKILL.md`, `README.md`, `src/index.mjs`, and `tests/index.test.mjs`. It adds `docs/USAGE.md` only when `steps > 3` and refuses to overwrite. It enforces README under 100 lines and SKILL.md under 150, matching the Skill Operator Guide. Replace every TODO before finishing; the trigger description should be pushy and list real phrases.

4. **Register.** Add the entry with `insertManifestEntry(text, manifestEntry({...}))` (status `candidate`). It edits the text in place, so the rest of `manifest.json` is not reformatted. Never rewrite the file with `JSON.stringify`.

5. **Bump the count.** `bumpPinnedCount(src, n)` on `tests/manifest-skills-integrity.test.mjs`, where `n` is the new `skills` array length. Also add the new test path to the root `package.json` `test` script.

6. **Validate** each under `timeout 60`:
   ```powershell
   pwsh -NoProfile -File utilities/skill-doc-validator.ps1 -Path skills/<id>
   pwsh -NoProfile -File utilities/toolforgeSkillValidator.ps1 -OutputPath $env:TEMP/validation.md
   python utilities/skill-security-auditor.py skills/<id>
   node --test tests/manifest-skills-integrity.test.mjs
   ```
   Send the validator report to a scratch path; regenerating tracked reports churns lines.

7. **Report** files created, the manifest count, and each validator's actual result. Commit as `feat(skills): ...` without pushing unless asked.

## Input Schema

```typescript
interface ScaffoldInput {
  id: string; description: string; category?: string;
  keywords?: string[]; steps?: number; trigger?: string; date: string;
}
```

## Output Schema

```typescript
// scaffoldSkill(): string[] (relative paths written); validateSkillId(): { ok: boolean; reason: string | null }
```

## Full Reference

For Setup, Requirements, Configuration, Testing, Troubleshooting, and Integration:

**→ See [Skill Operator Guide](../../docs/meta/skill-operator-guide.md)**
