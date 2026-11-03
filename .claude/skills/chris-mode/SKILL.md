---
name: chris-mode
description: "Chris's working conventions: autonomy/checkpoint balance, approval gates, git/process discipline, subagent dispatch, verification discipline, handoffs. Trigger on \"chris-mode\", \"work in my style\", or explicit invocation only, not a general keyword match."
disable-model-invocation: true
---

# Chris mode

Working conventions mined from feedback and correction patterns across this workspace. Read once per session if invoked. Don't restate it back to the user.

## Autonomy and checkpointing

Default to acting, not asking. On routine, reversible, in-scope work: just do it. No permission prompts for read-only steps or standard tool use.

The exception is blast radius, not task size. Once a scope is approved, still pause before any single step that's expensive to reverse: force-push, large deletion, rewriting already-shipped code, an external side effect (sending a message, merging a PR). A short "found X, about to do Y" before that step is cheap. Running the whole chain unattended is not what approval meant.

A question is not an order. "Did we…?", "why is X running?" never authorizes removing or killing anything. Check other sessions and processes before killing one.

Explicit boundaries hold: "read-only", "report only before any file changes", "spec, then stop before coding", "leave X", "defer". Don't re-raise a deferred item. For redesigns, show mock previews and wait for sign-off before touching files.

Before saying something is missing, not installed, or unknown, and before asking the user, search the stored context first: memory, TRM, installed tools, prior wraps. When the user references past work, read the matching wrap unprompted. Never offer an excuse where a search would have answered.

On long autonomous runs (multi-task plans, SDD execution), checkpoint every 5-8 tasks or when a session is clearly running long. Flag progress and rough time/token burn, then offer a handoff (see Handoffs).

Bound every run: use timeouts and a kill switch, and say why something is slow. If a background task doesn't return within one or two polling waits, stop polling in a blocking loop and switch to an event-driven watch.

## Decisions and approval gates

- End each turn with one concrete proposed next action. Offer choices as short lettered or numbered options with a recommendation first. The user answers with a token ("a", "2", "go"). That token approves only the step just proposed, not the chain after it.
- Commit, push, PR-open, and merge are separate approvals. Default: commit scoped to the named files, no push. Merge needs a per-PR go-ahead, usually conditional on CI. Branch and worktree deletion need their own. Hook skipping (`--no-verify`) only when the user grants it for that one push, with the reason in the PR body.
- Close each task with a list of what remains, so the user doesn't have to ask.
- Take every review or audit finding unless told otherwise. Default is fix-all, not triage.
- A bare failure paste or "failed" means pull the logs and fix. Don't ask for details.
- CI or hook fix loops: after about two failed attempts, stop and report the root cause and remaining risk. A recurring red check needs a root-cause fix, not another patch.
- If the user corrects a repo, org, path, or URL, they pasted the exact one. Re-confirm the target before the next write.
- A "why" or "what do you mean" is a challenge. Answer directly; don't redo the work or defend it. Draw a diagram when asked to compare options.

## Verification discipline

A subagent's or tool's self-report of "done," "tests pass," or "reverted cleanly" is a claim, not a fact. Before treating any of these as true:

- Rerun the actual command yourself and check the real exit code. Don't grep a summary for "PASS."
- Diff the actual files touched against what the report claims. Flag anything undisclosed.
- For "reverted to origin/main" or similar, diff against that ref directly.

This applies uniformly across agents (Codex, Antigravity, subagents). Failures are silent and confident regardless of source.

Claims from prior sessions ("work was done", "we integrated X") get the same treatment: grep for the actual artifacts rather than reasoning from the doc's or summary's confident tone. This cuts both ways: don't voice doubt about something real without checking first.

Before trusting a fix in any system with codegen, caching, or other side-effecting regeneration, run the code path that owns the file, not just read the diff.

Scope tests to the change. A GUI- or web-only change doesn't run the full suite.

## Pasted output from other agents

Pasted Codex, Gemini, or remote-session output prefixed "review" means verify it against the repo, then act. It may be meant for another session or repo: confirm the audience and target first. For Codex hand-offs, write full copy-paste instructions, then review its result later. If Codex reports blocked, explain why.

## Handoffs and stale state

- Offer a handoff to a fresh session at the end of a long chain. Name the exact PR, branch, worktree, and ledger path. A vague or stale handoff confuses the next session.
- Write each handoff to a real file in the memory dir and index it in `MEMORY.md`. Check that index links resolve.
- The user merges PRs and deletes branches themselves. Recheck PR and worktree state before assuming it's open. Fix a stale STATUS.md or memory entry immediately, not next session.
- Use existing tooling before improvising (for example the Ollama pause code already built).
- After a commit, either run `trail note` (one short decided, ruled-out, or watch-out note) or say "nothing worth keeping" in one line. Don't stall on the hook. Say `trail`, not `graft`, in docs.
- When the user must run a manual step, give full copy-paste commands and say exactly when and where.

## Git and process

- State every file path in full (`C:\dev\...`), including inside code blocks, chat replies, and end-of-turn summaries. Never a bare relative path.
- In this repo, `Edit`/`Write` rewrite CRLF files to LF wholesale, turning a one-line change into a full-file diff. For a small edit to a CRLF file, use `sed -i` instead, and verify with `git diff --stat` that only the intended lines changed.
- Never `git reset --hard` with a dirty working tree. It discards all uncommitted work, not just the target commit. Check `git status` first; if dirty, stash, `checkout -- <path>`, or work in a separate worktree instead.
- After any `git add -A`, check the command's own output for "adding embedded git repository" warnings. `git status` alone won't show them.
- If a repo has a CI bot that pushes back on every push, push once per session rather than after every commit.
- Commit-type tags: `chore(sync):` for bulk/automated resync commits; `test:` (or `test(qa):`) when a commit's primary content is test or regression coverage, even if it touches other files too.

## Subagent dispatch

- When dispatching a subagent to a specific path, make verifying that checkout (`cd <path> && git rev-parse --show-toplevel && git rev-parse HEAD`) its literal first command, not a prose instruction.
- When handing Codex a plan with literal code blocks, tell it explicitly to copy them verbatim. It will otherwise retype or condense them and introduce silent syntax errors.
- A subagent's completion report describes the scoped task, not everything that landed. Check the actual commit range (`git log`, `git show --stat`) for anything auto-pushed.
- For multiple same-shape background agents in parallel, poll proactively once elapsed time passes roughly 2x what sibling tasks took.

## Platform

Windows: run Docker commands from PowerShell directly, not bash under WSL. WSL bash can't reach the Docker Desktop socket.
