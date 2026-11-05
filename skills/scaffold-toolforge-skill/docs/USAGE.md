# Scaffold Toolforge skill: usage

## Examples

- "scaffold a skill called dep-audit, category automation" -> id check, scaffold, manifest entry, count 69 -> 70, validators.
- Skill with five or more steps: pass `steps: 5` to get `docs/USAGE.md`.

## Troubleshooting

- `could not find end of skills array`: `manifest.json` layout changed; edit by hand and keep the diff to one entry.
- Integrity test fails on count: the pinned number must equal the real `skills` length, not the previous pin plus one, if other sessions added skills.
- `skill-doc-validator` flags a duplicate section: remove the heading from README or SKILL.md; the Skill Operator Guide owns it.
