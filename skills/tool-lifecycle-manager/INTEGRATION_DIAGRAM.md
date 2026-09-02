# Tool Lifecycle Manager — Integration Diagram

```
┌─────────────────────────────────────────────────────────┐
│ Toolforge Skill Lifecycle                              │
└─────────────────────────────────────────────────────────┘

Pending                  Canonical               Distributed
   │                        │                         │
   ├──[SKILL.md]────────>  ├──[SKILL.json]────────>  ├──[skills/*]
   │                        │                         │
   └──[.SKILL.json]────────┘─[README.md]────────────┘
                            │
                            └──[INTEGRATION_DIAGRAM.md]


┌──────────────────────────────────────────┐
│ tool-lifecycle-manager Flow              │
└──────────────────────────────────────────┘

Install Phase:
  pending/ → canonical/ → distributed/ → manifest.json

Register Phase:
  canonical/ → Cowork registry

Validate Phase:
  Check all 5 systems: canonical, distributed, manifest, cowork, runtime

Discovery Phase:
  runtime/ can discover entrypoint from manifest
```

## Dependencies

- `toolforgeSkillInstaller.ps1` — creates skill in canonical
- `Invoke-CoworkSkillInstall.ps1` — registers in Cowork
- `toolforgeSkillValidator.ps1` — validates consistency

## Inputs

- Pending skill: `C:\dev\toolforge\audit\new-skills-pending-install`
- Manifest: `C:\dev\toolforge\manifest.json`

## Outputs

- Canonical skill: `C:\dev\toolforge\skills/<id>/`
- Distributed skill: `C:\dev\rewrite-mcp\toolforge\skills/<id>/`
- Manifest update: version bump, new entry
