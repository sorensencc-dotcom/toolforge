#!/usr/bin/env node
/**
 * wiki-sync-recovery diagnostic
 *
 * Reads a failed `npm run wiki:sync` / sync-github-wiki.mjs log (stdin or --log FILE)
 * and matches it against the known failure modes recorded in commits
 * 8e7f5603, 6ecf4cfe, d9f0d4dc. Prints the matching runbook entry: root cause,
 * the fix that already landed, and the operator action if it regressed.
 *
 * Usage:
 *   node scripts/sync-github-wiki.mjs 2>&1 | node skills/wiki-sync-recovery/src/diagnose.mjs
 *   node skills/wiki-sync-recovery/src/diagnose.mjs --log C:\path\to\wiki-sync.log
 *   node skills/wiki-sync-recovery/src/diagnose.mjs --json
 *
 * Exit codes: 0 = at least one failure mode matched, 1 = no match, 2 = bad input.
 */

import fs from 'node:fs';

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const value = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };

const MODES = [
  {
    id: 'auth-https-url',
    title: 'Wiki clone/push fails authentication',
    commit: '8e7f5603',
    patterns: [
      /Permission denied \(publickey\)/i,
      /could not read Username for 'https:\/\/github\.com'/i,
      /Authentication failed for 'https:\/\/github\.com/i,
      /fatal: could not read Password/i,
      /remote: (Invalid username or password|Support for password authentication)/i,
      /https:\/\/github\.com\/[^ ]*\.wiki\.git/i,
    ],
    cause:
      'sync-github-wiki.mjs cloned the wiki over an HTTPS URL. Automated runs have no ' +
      'interactive credential helper, so clone or push aborts.',
    fixed:
      'repoUrl default changed to SSH (git@github.com:...wiki.git) at sync-github-wiki.mjs:13.',
    action: [
      'Confirm sync-github-wiki.mjs:13 still uses the git@github.com: form (not https://).',
      'Confirm WIKI_REPO_URL / --repo-url overrides, if set, are also SSH.',
      'Verify the automation user has an SSH key loaded: `ssh -T git@github.com`.',
    ],
  },
  {
    id: 'temp-dir-locked',
    title: 'Cannot remove .wiki-publish-temp before clone (Windows lock)',
    commit: '6ecf4cfe',
    patterns: [
      /EBUSY: resource busy or locked/i,
      /ENOTEMPTY: directory not empty[^]*wiki-publish-temp/i,
      /EPERM: operation not permitted, (unlink|rmdir)[^]*wiki-publish-temp/i,
    ],
    cause:
      'A prior run left .wiki-publish-temp on disk and a virus scanner / Explorer / git ' +
      'held a handle, so the pre-clone fs.rmSync threw on Windows.',
    fixed:
      'Pre-clone rmSync wrapped with { maxRetries: 5, retryDelay: 500 } and swallowed ' +
      'at sync-github-wiki.mjs:172-175.',
    action: [
      'Confirm the retry options are still on the pre-clone rmSync (sync-github-wiki.mjs:174).',
      'If it still fails, raise maxRetries/retryDelay, or delete the stale temp dir manually.',
      'Cross-check the temp dir is now unique per run (see failure mode temp-dir-collision).',
    ],
  },
  {
    id: 'missing-root-image',
    title: 'validateMarkdownImages reports missing image for a root-relative reference',
    commit: '6ecf4cfe',
    patterns: [
      /Missing (image|images)[^]*->/i,
      /\bimage reference[^]*not found/i,
      /\.(png|jpg|jpeg|gif|svg|webp)\b[^]*(does not exist|not found|missing)/i,
    ],
    cause:
      'A wiki page references an image by a path that resolves from the repo root ' +
      '(or root/assets/), not from the page directory. The validator only checked ' +
      'relative-to-page and flagged it as missing.',
    fixed:
      'validateMarkdownImages now falls back to root/<target> and root/assets/<target>, ' +
      'copying the asset into place before failing (sync-github-wiki.mjs:70-86).',
    action: [
      'Read the "-> <target>" path in the log.',
      'Confirm the asset exists at repo root or root/assets/. If it does and the run ' +
      'still fails, the fallback-copy block regressed — re-check sync-github-wiki.mjs:70-86.',
      'If the asset is genuinely absent, add it or fix the reference in the source markdown ' +
      '(fix the source under docs/ or wiki/, never the generated copy).',
    ],
  },
  {
    id: 'temp-dir-collision',
    title: 'git clone aborts: target directory already exists / not empty',
    commit: 'd9f0d4dc',
    patterns: [
      /fatal: destination path '[^']*wiki-publish-temp[^']*' already exists and is not an empty directory/i,
      /already exists and is not an empty directory/i,
    ],
    cause:
      'Two wiki-sync runs overlapped (post-commit hook + manual, or two hooks) and both ' +
      'used the fixed .wiki-publish-temp path, so the second clone hit a populated dir.',
    fixed:
      'targetWikiDir default is now .wiki-publish-temp-<base36 timestamp>, unique per run ' +
      '(sync-github-wiki.mjs:14).',
    action: [
      'Confirm sync-github-wiki.mjs:14 still appends a per-run suffix (Date.now().toString(36)).',
      'Delete any leftover .wiki-publish-temp* dirs at the repo root.',
      'If runs still collide, serialize the callers (package.json wiki:sync / setup-git-hooks.ps1).',
    ],
  },
];

function readInput() {
  const logPath = value('--log');
  if (logPath) {
    if (!fs.existsSync(logPath)) {
      process.stderr.write(`diagnose: log file not found: ${logPath}\n`);
      process.exit(2);
    }
    return fs.readFileSync(logPath, 'utf8');
  }
  if (process.stdin.isTTY) {
    process.stderr.write(
      'diagnose: no input. Pipe a wiki-sync log on stdin or pass --log FILE.\n',
    );
    process.exit(2);
  }
  return fs.readFileSync(0, 'utf8');
}

const log = readInput();
const matched = MODES.filter((m) => m.patterns.some((re) => re.test(log)));

if (flag('--json')) {
  process.stdout.write(
    JSON.stringify(
      {
        status: matched.length ? 'matched' : 'no-match',
        matched: matched.map(({ patterns, ...rest }) => rest),
        timestamp: new Date().toISOString(),
      },
      null,
      2,
    ) + '\n',
  );
  process.exit(matched.length ? 0 : 1);
}

if (!matched.length) {
  process.stdout.write(
    'No known wiki-sync failure mode matched this log.\n' +
      'Known modes: ' +
      MODES.map((m) => m.id).join(', ') +
      '\nRead docs/USAGE.md and inspect scripts/sync-github-wiki.mjs directly.\n',
  );
  process.exit(1);
}

for (const m of matched) {
  process.stdout.write(
    `\n== ${m.id} (${m.commit}) ==\n` +
      `${m.title}\n\n` +
      `Cause:  ${m.cause}\n` +
      `Fixed:  ${m.fixed}\n` +
      `Do:\n` +
      m.action.map((a) => `  - ${a}`).join('\n') +
      '\n',
  );
}
process.exit(0);
