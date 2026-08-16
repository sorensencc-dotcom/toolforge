---
name: learning-two-skill-trees
description: "c:\\dev\\skills\\ and c:\\dev\\toolforge\\skills\\ are two separate git repos with duplicated skill content -- validator's canonical source is toolforge\\skills only"
metadata: 
  node_type: memory
  type: project
  originSessionId: 42f01400-e2ad-495c-8aab-219a5fbcf7c9
---

`C:\dev\toolforge\` is a **full independent git clone of the same remote**
as `C:\dev` itself (`origin` on both = `github.com/sorensencc-dotcom/
toolforge.git`, same `main` branch) — not a submodule, not a symlink, not
merely "duplicated skill content." It's gitignored from the c:\dev parent
repo (`/toolforge/` in `.gitignore`) so c:\dev's own git never sees it, but
it independently fetches/commits/pushes to the identical remote branch.
Because both clones' repo roots happen to contain a top-level `skills/`
directory (that's the shared remote's actual layout), `C:\dev\skills\<name>`
and `C:\dev\toolforge\skills\<name>` looked like "two skill trees" but are
really the same remote path checked out twice.

**Why this matters:** `utilities/toolforgeSkillValidator.ps1` hardcodes
`$CANONICAL_SKILLS = "C:\dev\toolforge\skills"` — so validator fixes must
land in the `toolforge/` clone's working tree specifically (2026-07-16,
fixing 8 canonical errors: wrote docs into `c:\dev\skills\...` first,
validator still failed until mirrored into `c:\dev\toolforge\skills\...`).
Separately, and more dangerously: because both clones push to the *same*
remote `main`, committing in one and pushing, then committing+pushing from
the other, produces real divergent-history conflicts — not just doc
duplication. Hit this same session: pushing from `c:\dev` first meant
`toolforge/`'s own local commit (`ff4ba8e`) became redundant (content
already on `origin/main` via the other clone) and had to be discarded via
`git reset --hard origin/main` after confirming no unique content would be
lost.

**How to apply:** Before committing+pushing in `toolforge/`, check whether
`c:\dev` has already pushed equivalent changes to the same remote — `git
fetch && git log HEAD..origin/main` from inside `toolforge/` reveals it
immediately. Prefer doing the push from just ONE of the two clones per
logical change, not both, to avoid the redundant-commit dance. There's a
third tree too (`C:\dev\rewrite-mcp\toolforge\skills`, a distributed sync
target, not a live clone of the same remote — check
`toolforgeSkillValidator.ps1`'s `$DISTRIBUTED_SKILLS` before assuming that
one behaves the same way).

**Recurred 2026-07-17, twice, despite this memory existing** — did not
check memory before starting multi-repo work, hit two separate
non-fast-forward push rejections (one on each clone) mid-session, each
requiring fetch+rebase to resolve; one collision landed directly in
`manifest.json`, the exact shared file this memory already named as the
conflict surface. **Process fix, not just awareness:** before touching
either clone, run `git fetch && git status -sb` in BOTH `c:\dev` and
`c:\dev\toolforge` up front, not just before the push at the end — the
awareness existed, checking early didn't happen. Also: same-session
`skill-security-auditor.py` exists as two separately-tracked copies (one
per clone) with independently-drifting content — a fix landed in only the
`toolforge/` copy silently failed to take effect because the pre-push hook
loads the `C:\dev\skills\...` copy at runtime via a hardcoded relative
path from `C:\dev\skill-security-auditor.py`'s wrapper. Any fix to that
script needs to land in both copies, verified by actually re-running the
hook, not just by editing the file you found first.
