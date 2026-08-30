# wiki-sync-recovery — usage and runbook

## When to use

`npm run wiki:sync` / `npm run wiki:publish` (both run
[scripts/sync-github-wiki.mjs](../../../scripts/sync-github-wiki.mjs)) failed, or
the post-commit wiki hook printed a warning. Capture the output and feed it to the
diagnostic before editing the script.

```bash
node scripts/sync-github-wiki.mjs 2>&1 | tee C:\dev\logs\wiki-sync.log | node skills/wiki-sync-recovery/src/diagnose.mjs
```

The matcher is read-only. It never edits the script or the wiki clone.

## Failure modes

All four were fixed on 2026-08-29. The diagnostic exists to catch a **regression**
of one of them, or a new environment hitting the same class of bug.

### 1. `auth-https-url` (fix `8e7f5603`)

- **Log signature**: `Permission denied (publickey)`, `could not read Username for 'https://github.com'`, `Authentication failed`, or an `https://github.com/...wiki.git` URL in the clone line.
- **Cause**: the wiki was cloned over HTTPS; automated runs have no credential helper.
- **Fix location**: `sync-github-wiki.mjs:13` — `repoUrl` default is `git@github.com:sorensencc-dotcom/toolforge.wiki.git`.
- **If regressed**: check line 13 is still the `git@github.com:` form; check `WIKI_REPO_URL` / `--repo-url` overrides are SSH; run `ssh -T git@github.com` as the automation user.

### 2. `temp-dir-locked` (fix `6ecf4cfe`)

- **Log signature**: `EBUSY: resource busy or locked`, `ENOTEMPTY: directory not empty ...wiki-publish-temp`, `EPERM ... unlink ...wiki-publish-temp`.
- **Cause**: a stale `.wiki-publish-temp` dir plus a Windows file handle (AV scan, Explorer, git) blocked the pre-clone `fs.rmSync`.
- **Fix location**: `sync-github-wiki.mjs:172-175` — `rmSync(..., { recursive: true, force: true, maxRetries: 5, retryDelay: 500 })` in a swallowed `try`.
- **If regressed**: confirm the retry options are still on line 174; raise them if needed; delete the stale temp dir manually.

### 3. `missing-root-image` (fix `6ecf4cfe`)

- **Log signature**: `Missing image ... -> <path>`, or an image path reported as not found by `validateMarkdownImages`.
- **Cause**: a wiki page references an image by a path that resolves from the repo root (or `root/assets/`), not from the page's own directory.
- **Fix location**: `sync-github-wiki.mjs:70-86` — falls back to `root/<target>` then `root/assets/<target>`, copying the asset into the wiki tree before deciding it is missing.
- **If regressed**: read the `-> <target>` path; if the asset exists at root or `root/assets/` and the run still fails, the fallback-copy block regressed. If the asset is truly absent, add it or fix the reference **in the source** under `docs/` or `wiki/` — never in the generated wiki copy.

### 4. `temp-dir-collision` (fix `d9f0d4dc`)

- **Log signature**: `fatal: destination path '.wiki-publish-temp...' already exists and is not an empty directory`.
- **Cause**: two wiki-sync runs overlapped and both used the fixed `.wiki-publish-temp` path.
- **Fix location**: `sync-github-wiki.mjs:14` — `targetWikiDir` default appends `-${Date.now().toString(36)}`, unique per run.
- **If regressed**: confirm line 14 still appends the per-run suffix; delete leftover `.wiki-publish-temp*` dirs; serialize callers (`package.json` scripts, `setup-git-hooks.ps1`) if runs still overlap.

## Worked example

```
$ node scripts/sync-github-wiki.mjs 2>&1 | node skills/wiki-sync-recovery/src/diagnose.mjs

== auth-https-url (8e7f5603) ==
Wiki clone/push fails authentication

Cause:  sync-github-wiki.mjs cloned the wiki over an HTTPS URL. Automated runs have no
        interactive credential helper, so clone or push aborts.
Fixed:  repoUrl default changed to SSH (git@github.com:...wiki.git) at sync-github-wiki.mjs:13.
Do:
  - Confirm sync-github-wiki.mjs:13 still uses the git@github.com: form (not https://).
  - Confirm WIKI_REPO_URL / --repo-url overrides, if set, are also SSH.
  - Verify the automation user has an SSH key loaded: `ssh -T git@github.com`.
```

Exit `0`: a mode matched. Exit `1`: no match — the failure is new; read the script
directly. Exit `2`: no log was supplied.

## Multiple matches

`6ecf4cfe` bundled two unrelated fixes, so a log can match both `temp-dir-locked`
and `missing-root-image`. The diagnostic prints every match; work them
independently.

## Adding a failure mode

Append an entry to the `MODES` array in
[../src/diagnose.mjs](../src/diagnose.mjs): `id`, `title`, `commit`, `patterns`
(array of `RegExp`), `cause`, `fixed` (a `file:line`), and `action` (string array).
Keep patterns anchored to text the script actually prints.
