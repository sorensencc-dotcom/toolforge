---
name: session-wrap-2026-07-16-noqa-policy
description: Documented the noqa:SEC-AUDITOR exemption policy that existed only as tribal/code convention; pushed clean despite slow hooks and a false-alarm stash collision
metadata: 
  node_type: memory
  type: project
  originSessionId: 6b69e087-9403-44bc-916e-257123b76bd1
---

Added a formal Exemption Policy section to `skills/skill-security-auditor/SKILL.md`
after discussion surfaced that `# noqa: SEC-AUDITOR` was already a live convention
in code (auditor's own self-referential pattern strings, plus a genuine exemption
in [[cic-run-gate]]'s `child_process.spawn` call, commit `43f4f06`) but had zero
governance documentation — anyone could silence a CRITICAL finding with a bare
comment, no Tier 1 gate, no required justification.

**Fix:** two exemption classes now documented — self-referential false-positive
(Tier 2, no sign-off) vs genuine safety-gate exception (Tier 1 required, per
existing Global Operating Rules "exceptions require Tier 1 approval + documented
reason"). Format changed from bare `# noqa: SEC-AUDITOR` to
`# noqa: SEC-AUDITOR: <reason>` — reason mandatory, must also appear in commit
message for genuine exemptions.

**Why this matters going forward:** any new skill code touching `spawn`/`exec`/
`subprocess` will trip the auditor's CMD-INJECT/CODE-EXEC patterns — expect to use
this exemption path repeatedly, and expect to check `grep -rn "noqa: SEC-AUDITOR"`
before assuming a bypass pattern doesn't already exist (this session initially
almost duplicated the convention from scratch — see [[learning-two-skill-trees]]
for the parallel "should've checked first" lesson from earlier the same day).

**Push friction, not a real problem:** pre-commit/pre-push hooks in this repo run
the full skill-validator + security-audit suite (60-90s+ per commit) — background
every commit/push with a long timeout rather than retrying in a tight loop. One
commit-msg hook silently rewrites messages to a normalized form (harmless). One
rebase hit a `.claude/settings.json` stash conflict that looked like a real
concurrent-session collision but was pure CRLF/LF noise — diffed stash vs working
tree before assuming data loss, found them byte-identical modulo line endings,
dropped the stash safely. Two untracked files from a clearly concurrent session
(`.playwright-mcp/`, `docs/meta/specs/cic-tool-surface-phase3-design.md`) were
left alone rather than swept into the commit.
