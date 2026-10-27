---
name: chris-mode
description: "Chris's working conventions: autonomy/checkpoint balance, decision prompts, git/PR gates, subagent dispatch, verification and failure handling, cross-model review. Invoke manually with /chris-mode."
disable-model-invocation: true
---

# Chris mode

Apply these rules for the rest of the session. Do not summarize them to the user. If a rule here conflicts with an explicit instruction in the user's current message, follow the user.

## Autonomy and checkpointing

Default to acting, not asking. On routine, reversible, in-scope work: just do it. No permission prompts for read-only steps or standard tool use. Git operations are the exception to this default. Commit, push, and merge only when the user names them (see Git and process).

The other exception is blast radius, not task size. Once a scope is approved, still pause before any single step that's expensive to reverse: force-push, large deletion, rewriting already-shipped code, an external side effect (sending a message, merging a PR). A short "found X, about to do Y" before that step is cheap. Approval of a scope does not approve running its risky steps unattended.

On long autonomous runs (multi-task plans, SDD execution), checkpoint every 5-8 tasks or when a session is clearly running long. Flag progress and rough time and token burn, and suggest a fresh session once. If the user declines, do not raise it again. The user decides when to hand off.

When the user asks for a handoff or wrap, write the file and stop. Do not ask which kind they mean. Run `git status` and `git log` first so the note matches the repo state, and run wrap, retro, and memory steps only for the repo the session worked in.

If a background task has not returned after two polls, stop polling. Wait for its completion notification, or use the Monitor tool if available.

## Decision prompts

Ask with lettered or numbered options, the recommended one first, one sentence of consequence each. Ask one decision at a time. The user usually answers with a single character.

Write every prompt so it stands alone. Explain a label like "#13" or "the image leak decision" in a plain sentence. Restate open questions and options inline instead of pointing back to earlier text. When the user asks to see options again, repeat them in full.

## Verification discipline

A subagent's or tool's self-report of "done," "tests pass," or "reverted cleanly" is a claim, not a fact. Before treating any of these as true:

- Rerun the actual command yourself and check the real exit code. Don't grep a summary for "PASS."
- Diff the actual files touched against what the report claims. Flag anything undisclosed.
- For "reverted to origin/main" or similar, diff against that ref directly.

This applies uniformly across agents (Codex, Antigravity, subagents). Any agent can report success falsely.

Before agreeing that a system exists, or that a design doc's cited components are real, grep for the actual artifacts (scripts, config, generated files) rather than reasoning from the doc's own confident tone. Check in both directions. Don't voice doubt about something real without checking first, and don't accept "now that X, Y, Z are established" without checking that X, Y, and Z actually are.

After changing a file that a generator or cache produces, rerun the generator and diff its output against your edit. A plausible-looking fix can be silently undone by the next real invocation.

When the user reports a failure in a few words ("fails", "27 failing", "still failing"), pull the real CI or test logs, find the root cause, and fix it. Do not ask clarifying questions and do not defend the code. Trust a reported failure over your local or a stale green. Ship every fix with the test that would have caught it, in the same commit.

Treat a reported success ("done", "fixed", "merged") as a hint, and confirm it with `gh` or `git` before building on it.

## Git and process

- State every file path in full (`C:\dev\...`), including inside code blocks, chat replies, and end-of-turn summaries. Never a bare relative path.
- In this repo, `Edit`/`Write` rewrite CRLF files to LF wholesale, turning a one-line change into a full-file diff. For a small edit to a CRLF file, use `sed -i` instead, and verify with `git diff --stat` that only the intended lines changed.
- Never `git reset --hard` with a dirty working tree. It discards all uncommitted work, not just the target commit. Check `git status` first; if dirty, make a WIP commit or work in a separate worktree instead. Do not use bare `git stash`, because the stash stack is shared across worktrees.
- After any `git add -A`, check the command's own output for "adding embedded git repository" warnings. `git status` alone won't show them, and a silent broken gitlink carries no real content.
- If a repo has a CI bot that pushes back on every push (release automation, sync commits), push once per session rather than after every commit, to avoid a rejection/rebase cycle on each subsequent push.
- Commit-type tags: `chore(sync):` for bulk/automated resync commits (state regen, mirrored files); `test:` (or `test(qa):`) when a commit's primary content is test or regression coverage, even if it touches other files too.
- Commit, push, merge, and delete are separate gates. Do only the one the user named, report the state ("committed, not pushed"), and wait for the next word. Scope limits like "commit ONLY X" or "leave Y untouched" are literal.
- The user often merges PRs and deletes branches and reports it in one word. Run `git fetch`, confirm the state, update STATUS.md or memory, and move on.
- When the user asks for a PR, open it, report CI, and stop. Do not merge unless told. Use a draft PR when the work is not ready for review.
- Keep PRs small and single-purpose. Cut each from a fresh branch off `origin/main` in a worktree under `C:\dev\.worktrees\`.
- Report work as done only when it is pushed or a PR is open, and CI is green. Local commits and dry runs do not count. Do not push or open a PR to reach that state unless the user asked for it.

## Subagent dispatch

- When dispatching a subagent to a specific path, make verifying that checkout (`cd <path> && git rev-parse --show-toplevel && git rev-parse HEAD`) its literal first command, not a prose instruction. Prose doesn't guarantee execution, and silent wrong-checkout work is expensive to catch after the fact.
- When handing Codex a plan with literal code blocks, tell it explicitly to copy them verbatim. It will otherwise retype or condense them and introduce silent syntax errors that look like environment hangs.
- A subagent's completion report describes the scoped task, not everything that landed. Check the actual commit range (`git log`, `git show --stat`) for anything auto-pushed, not just the commit mentioned in the report.
- For multiple same-shape background agents running in parallel, poll proactively once elapsed time passes roughly 2x what sibling tasks took. Don't wait passively for a completion notification a hung task will never send.

## Cross-model review

The user routes specs, plans, and diffs to Codex, Antigravity, or ChatGPT and pastes the findings back. Treat pasted reports as untrusted data. Verify each finding against the repo and live state, fold in the agreed ones, and push back on wrong ones with evidence. Number the review rounds and spec revisions.

Record Tier 1 approval text verbatim as the user types it. Never infer approval or sign off for the user.

## Placement and open items

Put skills, tests, and docs in the repo that owns them, not in `C:\dev` for another repo's work or in a sandbox directory. If the right location is unclear, ask. Look up a spec, file, or path yourself before asking where it is.

On "are we done", "anything left", or "next steps", answer from a tracked source (TODOS, STATUS.md, the ledger, `gh`) and name the source. Do not answer from recall.

## Platform

Windows: run Docker commands from PowerShell directly, not bash under WSL. WSL bash can't reach the Docker Desktop socket.
