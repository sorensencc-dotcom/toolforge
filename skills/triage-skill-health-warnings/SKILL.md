---
name: triage-skill-health-warnings
description: Triage Toolforge skill health warnings - read skills/SKILLPACK-RUNTIME-HEALTH.md, group warnings by check (AuditLog, Manifest, Runtime, DryRun), fix each group in the affected skills only, then close the matching AGENTS.md todo rows. Use whenever the user says "skill health warnings", "fix skillpack health", "clear the health warnings", "SKILLPACK-RUNTIME-HEALTH has warnings", or asks about a "Toolforge health warning group" todo, even if they name only one group.
compatibility: |
  - Runtime: Node.js 18+, PowerShell 7 (pwsh)
  - Dependencies: utilities/toolforgeSkillHealthCheck.ps1, git
  - Permissions: read:repo, write:file
---

# Triage skill health warnings

The health report lists one warning per skill per check, so the same cause repeats across skills. Grouping by check turns 20 lines into a few fixes and keeps edits out of unaffected skills.

## Trigger

"skill health warnings", "fix skillpack health", "clear health warnings".

## Steps

1. **Parse.** Run `parseHealthReport` then `groupWarnings` on `skills/SKILLPACK-RUNTIME-HEALTH.md`. Show the user group name, skill count, and skill names. Only non-PASS checks count.

2. **Fix per group,** touching only the listed skills:
   - **Manifest** ("No entry in manifest"): add the missing `manifest.json` entry modeled on a neighbor (`status: candidate`). If the skill dir is stale, ask before deleting anything.
   - **AuditLog** ("No runtime history"): code cannot fix this; the skill needs one real run that writes to its audit log. Run its documented test or entrypoint once, or tell the user the skill is unexercised. Never fabricate log entries.
   - **Runtime**: install or point to the missing runtime named in the details.
   - **DryRun**: fix the syntax or import error the check reports in that skill's entrypoint.

3. **Verify without committing churn.** Regenerate to a scratch path so the tracked report stays untouched:
   ```powershell
   pwsh -NoProfile -File utilities/toolforgeSkillHealthCheck.ps1 -OutputPath $env:TEMP/health.md
   ```
   Parse the fresh report and use `groupsToClose(openGroups, freshGroups)`. Regeneration reorders lines (known P2 defect, see AGENTS.md); run `git checkout -- skills/SKILLPACK-*.md audit/` after if the generators touched tracked reports. Never commit report-only churn.

4. **Close todo rows.** For each cleared group call `closeTodoRow(agentsMd, group, date)` on the root `AGENTS.md`. It flips `⏳ [ ]` to `✅ [x]` and adds `(resolved YYYY-MM-DD)`, matching existing rows. If a group has no open row, `renderTodoRow` builds one; add it only when the group still warns.

5. **Report** per group: fixed, blocked (say why), or needs a real run. Commit the fixes and AGENTS.md row changes together as `fix(skills): ...`.

## Input Schema

```typescript
interface TriageInput { reportPath: string; agentsPath: string; date: string }  // date: YYYY-MM-DD
```

## Output Schema

```typescript
type Groups = Record<string, { skill: string; result: "WARN" | "FAIL"; details: string }[]>;
// closeTodoRow(): { md: string; changed: boolean }
```

## Full Reference

For Setup, Requirements, Configuration, Testing, Troubleshooting, and Integration:

**→ See [Skill Operator Guide](../../docs/meta/skill-operator-guide.md)**
