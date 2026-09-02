---
name: session-wrap-2026-07-17-skills-cleanup
description: "Fixed /retro non-invocability + cleaned up ~/.claude/skills/ global folder: 792 stray .bak files, 3 stale pre-graduation skill copies, 1 marketplace-duplicate; 26 orphan drafts left for manual triage"
metadata: 
  node_type: memory
  type: project
  originSessionId: 6b69e087-9403-44bc-916e-257123b76bd1
---

Follow-on from [[session-wrap-2026-07-16-noqa-policy]]: investigating why gstack's
`/retro` couldn't be invoked via the Skill tool surfaced that `~/.claude/skills/`
(global, machine-wide, outside any project repo) had real accumulated cruft.

**Root cause of the /retro issue:** Claude Code's skill scanner only auto-registers
top-level `~/.claude/skills/<name>/SKILL.md`. gstack ships ~40 sub-skills one level
deeper (`~/.claude/skills/gstack/retro/SKILL.md`, etc.) — never independently
registered. Fix: Windows directory junctions (`New-Item -ItemType Junction`, no
admin needed) for the three actually used — `gstack-retro`, `gstack-ship`,
`gstack-review` — pointing at the real nested dirs. Confirmed working (they now
appear as independently invocable Skill-tool targets). Did NOT junction all 48 —
unnecessary blast radius, risk of colliding with unrelated top-level skills sharing
a name (e.g. generic `review`).

**Cruft found and removed from `~/.claude/skills/`:**
- 792 stray `.bak` files from a runaway backup loop on one file
  (`artifact-sync-to-onedrive.md`) — never git-tracked, pure filesystem litter.
- `roadmap-validator/`, `work-summarizer/` — stale pre-graduation prototype copies.
  Confirmed via diff + toolforge manifest.json: both are registered
  `canonical: true` in `c:\dev\toolforge\skills\` with newer, more complete
  versions (work-summarizer is v4.0.0 vs. home's untagged early draft). Deleted
  the home copies, not the canonical ones.
- `work-summarizer-v2/` — home-only, never graduated, v2.0.0 "deterministic
  no-LLM" design. Verified canonical v4.0.0 already contains v2's distinguishing
  features (`routing-artifact.ts`, `transcript-excerpts.ts`, MAAL routing) — fully
  absorbed, nothing left to migrate. Deleted.
- `fewer-permission-prompts.md` — confirmed via local `manifest.json`
  (`sourceRepo: github.com/anthropics/claude-skills`) as a stale synced copy of a
  skill already live separately. Deleted.

**Left open, needs the user's judgment call, not mine:** 26 more loose `.md` draft
skills in the same folder (CIC/MEE pipeline tooling, roadmap automation, skill
meta-tooling, cost/ops monitoring, session/retro tooling) — none registered
anywhere, none duplicated in toolforge, all dated 2026-06-22 to 06-29 with no
activity since. Triage table published as an artifact
(https://claude.ai/code/artifact/01816f4d-2b18-4182-a94b-986ead38fc78) grouped by
domain, flagging 4 likely overlaps with things that already exist
(`session-wrap.md`/`retrospective-analyzer.md` vs. gstack's own `/retro`+`/learn`;
`skill-health-monitor.md`/`automation-audit.md` vs. toolforge's
`toolforge-drift-monitor`; `permission-audit.md` vs. the now-deleted
`fewer-permission-prompts.md`) — none of the four verified line-by-line, flagged
as "check before reviving" only.

**Also discovered, not acted on:** `~/.claude/skills/` is itself a dead git repo —
2 commits total, no remote configured, and everything touched this session
(including all 26 drafts, `gstack/`, `contributions/`, `manifest.json`) was never
tracked in it at all. Left as-is; committing today's triage-in-progress state into
a vestigial repo with no remote wasn't worth doing. If this folder is going to keep
existing, it either needs a real remote + regular commits, or the git wrapper
should come off since it's never been used as one.

**Why this matters going forward:** the same "prototype in global home folder,
forget to clean up after graduating to canonical library" pattern that produced
the 3 stale skill dirs could easily recur — worth checking `~/.claude/skills/`
root periodically, not just `c:\dev\toolforge\skills\`, when auditing skill
sprawl.
