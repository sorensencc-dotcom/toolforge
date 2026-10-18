import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  changedFilesFromRanges,
  checkDirtyWiki,
  cleanGitEnv,
  commitIdentityEnv,
  diffRangeCandidates,
  evaluatePublishGuards,
  gitAuthEnv,
  publish,
  redactSecrets,
  resolveBranch,
  resolveWikiAuth,
  wikiPagesFromRepo
} from '../scripts/publish-repo-wiki-pages.mjs';

// Windows can briefly hold handles on freshly used temp dirs (EPERM); a leaked temp dir must not fail a test.
function rmQuiet(dir) {
  try {
    fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  } catch {
    // leave the temp dir behind
  }
}

const SCRIPT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'scripts', 'publish-repo-wiki-pages.mjs');
const SHA_A = 'a'.repeat(40);
const SHA_B = 'b'.repeat(40);
const ZERO = '0'.repeat(40);
// Fake fixture value, assembled so it does not look like a real credential to the secret scan.
const FAKE_CREDENTIAL = ['ghs', 'FIXTURE0123456789abcdef'].join('_');
const IDENTITY = { GIT_AUTHOR_NAME: 'Wiki Test', GIT_AUTHOR_EMAIL: 'wiki-test@example.com', GIT_COMMITTER_NAME: 'Wiki Test', GIT_COMMITTER_EMAIL: 'wiki-test@example.com' };

function sh(args, cwd, env = {}) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', env: { ...cleanGitEnv(), ...IDENTITY, ...env } }).trim();
}

function seedBareWiki() {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'wiki-remote-'));
  const bare = path.join(base, 'wiki.git');
  const seed = path.join(base, 'seed');
  sh(['init', '--bare', '-b', 'master', bare], base);
  sh(['init', '-b', 'master', seed], base);
  fs.writeFileSync(path.join(seed, 'Home.md'), '# Home\n');
  sh(['add', '--', 'Home.md'], seed);
  sh(['commit', '-m', 'seed'], seed);
  sh(['push', bare, 'master'], seed);
  return { base, bare };
}

test('diff ranges on a push to main use the event before..sha and never the empty origin/main...HEAD', () => {
  const env = { GITHUB_EVENT_NAME: 'push', WIKI_DIFF_BASE: SHA_A, WIKI_DIFF_HEAD: SHA_B };
  const ranges = diffRangeCandidates({ env, upstream: 'origin/main', branch: 'main' });
  assert.equal(ranges[0], `${SHA_A}..${SHA_B}`);
  assert.ok(!ranges.some((r) => r.startsWith('origin/')), ranges.join(', '));
  assert.ok(ranges.includes('HEAD~1..HEAD'));
});

test('diff ranges handle first push (zero SHA) and a missing before by falling back to HEAD~1..HEAD', () => {
  for (const before of [ZERO, '']) {
    const ranges = diffRangeCandidates({ env: { GITHUB_EVENT_NAME: 'push', WIKI_DIFF_BASE: before, WIKI_DIFF_HEAD: SHA_B } });
    assert.equal(ranges[0], 'HEAD~1..HEAD');
  }
});

test('diff ranges: pull requests diff against the base, local runs diff against upstream then origin/main off main', () => {
  assert.equal(diffRangeCandidates({ env: { GITHUB_EVENT_NAME: 'pull_request', GITHUB_BASE_REF: 'main' } })[0], 'origin/main...HEAD');
  const local = diffRangeCandidates({ env: {}, upstream: 'origin/feature', branch: 'feature' });
  assert.deepEqual(local.slice(0, 2), ['origin/feature...HEAD', 'origin/main...HEAD']);
  assert.ok(!diffRangeCandidates({ env: {}, upstream: '', branch: 'main' }).includes('origin/main...HEAD'));
});

test('changedFilesFromRanges: first accepted range wins even if empty; unknown ranges fall through; all failing returns null', () => {
  const calls = [];
  const run = (args) => {
    calls.push(args.join(' '));
    if (args.includes('bad..range')) throw new Error('bad object');
    if (args.includes('empty..range')) return '';
    return 'wiki/Home.md\nREADME.md';
  };
  assert.deepEqual(changedFilesFromRanges(['bad..range', 'ok..range'], run), ['wiki/Home.md', 'README.md']);
  assert.deepEqual(changedFilesFromRanges(['empty..range', 'ok..range'], run), []);
  assert.equal(changedFilesFromRanges(['bad..range'], () => { throw new Error('x'); }), null);
});

test('changedFilesFromRanges against real git: before..sha sees the push, ROOT sees a root commit', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wiki-diff-'));
  sh(['init', '-b', 'main', dir], dir);
  fs.writeFileSync(path.join(dir, 'a.txt'), 'a\n');
  sh(['add', '--', 'a.txt'], dir);
  sh(['commit', '-m', 'one'], dir);
  const first = sh(['rev-parse', 'HEAD'], dir);
  fs.mkdirSync(path.join(dir, 'wiki'));
  fs.writeFileSync(path.join(dir, 'wiki', 'Page.md'), 'p\n');
  sh(['add', '--', 'wiki/Page.md'], dir);
  sh(['commit', '-m', 'two'], dir);
  const second = sh(['rev-parse', 'HEAD'], dir);
  const run = (args, cwd) => sh(args, cwd);
  assert.deepEqual(changedFilesFromRanges([`${first}..${second}`], run, dir), ['wiki/Page.md']);
  // A force-pushed/unknown before SHA falls through to HEAD~1..HEAD.
  assert.deepEqual(changedFilesFromRanges([`${SHA_A}..${second}`, 'HEAD~1..HEAD'], run, dir), ['wiki/Page.md']);
  // Root commit: HEAD~1 does not exist, ROOT lists its own files.
  sh(['checkout', '-q', first], dir);
  assert.deepEqual(changedFilesFromRanges(['HEAD~1..HEAD', 'ROOT'], run, dir), ['a.txt']);
  rmQuiet(dir);
});

test('guards: dirty tree is evaluated before the branch guard, and both are reported', () => {
  const guards = evaluatePublishGuards({ branch: 'feature/x', dirty: [' M wiki/Home.md'], env: {} });
  assert.deepEqual(guards.map((g) => g.code), ['REFUSING_WIKI_PUBLISH', 'REFUSING_WIKI_PUBLISH_BRANCH']);
  assert.match(guards[0].message, /wiki\/Home\.md/);
});

test('guards: a clean main push passes; pull request events never publish; non-main refuses', () => {
  assert.deepEqual(evaluatePublishGuards({ branch: 'main', dirty: [], env: { GITHUB_ACTIONS: 'true', GITHUB_EVENT_NAME: 'push' } }), []);
  assert.deepEqual(
    evaluatePublishGuards({ branch: 'main', dirty: [], env: { GITHUB_ACTIONS: 'true', GITHUB_EVENT_NAME: 'pull_request' } }).map((g) => g.code),
    ['REFUSING_WIKI_PUBLISH_EVENT']
  );
  assert.equal(evaluatePublishGuards({ branch: 'autoheal-wrapper', dirty: [], env: {} })[0].code, 'REFUSING_WIKI_PUBLISH_BRANCH');
});

test('resolveBranch trusts the Actions ref and never maps a PR merge ref to main', () => {
  assert.equal(resolveBranch({ GITHUB_ACTIONS: 'true', GITHUB_REF: 'refs/heads/main' }, () => 'detached'), 'main');
  assert.equal(resolveBranch({ GITHUB_ACTIONS: 'true', GITHUB_REF: 'refs/pull/7/merge' }, () => 'main'), 'ref:refs/pull/7/merge');
  assert.equal(resolveBranch({}, () => 'local-branch'), 'local-branch');
});

test('auth: WIKI_PUSH_TOKEN wins over GITHUB_TOKEN; CI without a token is unusable; local falls back to ssh', () => {
  assert.equal(resolveWikiAuth({ WIKI_PUSH_TOKEN: 'w', GITHUB_TOKEN: 'g' }).source, 'WIKI_PUSH_TOKEN');
  assert.equal(resolveWikiAuth({ WIKI_PUSH_TOKEN: '  ', GITHUB_TOKEN: 'g' }).source, 'GITHUB_TOKEN');
  assert.equal(resolveWikiAuth({ GITHUB_ACTIONS: 'true' }).mode, 'none');
  const local = resolveWikiAuth({});
  assert.equal(local.mode, 'ssh');
  assert.match(local.url, /^git@github\.com:/);
  assert.match(resolveWikiAuth({ GITHUB_TOKEN: 'g' }).url, /^https:\/\/github\.com\/.+\.wiki\.git$/);
});

test('auth env carries the token only as an encoded header in the environment, never in argv or the URL', () => {
  const auth = resolveWikiAuth({ WIKI_PUSH_TOKEN: FAKE_CREDENTIAL });
  assert.ok(!auth.url.includes(FAKE_CREDENTIAL));
  const env = gitAuthEnv(auth);
  const values = Object.entries(env).filter(([k]) => k !== 'GIT_CONFIG_VALUE_0').map(([, v]) => v);
  assert.ok(values.every((v) => !v.includes(FAKE_CREDENTIAL)));
  assert.match(env.GIT_CONFIG_VALUE_0, /^Authorization: Basic /);
  assert.equal(env.GIT_CONFIG_KEY_0, 'http.https://github.com/.extraheader');
  assert.equal(env.GIT_TERMINAL_PROMPT, '0');
  assert.deepEqual(gitAuthEnv({ mode: 'ssh', token: null }), { GIT_TERMINAL_PROMPT: '0' });
});

test('redactSecrets removes the token and its base64 form', () => {
  const auth = { token: FAKE_CREDENTIAL };
  const basic = Buffer.from(`x-access-token:${FAKE_CREDENTIAL}`).toString('base64');
  const out = redactSecrets(`failed ${FAKE_CREDENTIAL} header ${basic}`, auth);
  assert.ok(!out.includes(FAKE_CREDENTIAL) && !out.includes(basic));
  assert.equal(redactSecrets('nothing here', { token: null }), 'nothing here');
});

test('commit identity only comes from CI or explicit WIKI_COMMIT_AUTHOR_* variables, never git config', () => {
  assert.deepEqual(commitIdentityEnv({}), {});
  assert.equal(commitIdentityEnv({ GITHUB_ACTIONS: 'true' }).GIT_AUTHOR_NAME, 'github-actions[bot]');
  assert.equal(commitIdentityEnv({ WIKI_COMMIT_AUTHOR_NAME: 'n', WIKI_COMMIT_AUTHOR_EMAIL: 'e@x' }).GIT_COMMITTER_EMAIL, 'e@x');
});

test('publish pushes to a local bare wiki, leaves no token behind, and a second run is a no-op', () => {
  const { base, bare } = seedBareWiki();
  const pages = [wikiPagesFromRepo()[0]];
  const auth = { mode: 'https-token', source: 'WIKI_PUSH_TOKEN', token: FAKE_CREDENTIAL, url: bare };
  const env = { ...process.env, WIKI_COMMIT_AUTHOR_NAME: 'Wiki Test', WIKI_COMMIT_AUTHOR_EMAIL: 'wiki-test@example.com' };
  const logs = [];
  const origLog = console.log;
  console.log = (...a) => logs.push(a.join(' '));
  try {
    publish(pages, { auth, env });
    assert.match(logs.join('\n'), /Published/);
    assert.equal(sh(['log', '-1', '--format=%an <%ae>%n%s', 'master'], bare), 'Wiki Test <wiki-test@example.com>\ndocs(wiki): publish repo wiki pages');
    assert.ok(sh(['ls-tree', '--name-only', 'master'], bare).includes(pages[0].dest));
    const before = sh(['rev-parse', 'master'], bare);
    logs.length = 0;
    publish(pages, { auth, env });
    assert.match(logs.join('\n'), /already match/);
    assert.equal(sh(['rev-parse', 'master'], bare), before);
  } finally {
    console.log = origLog;
  }
  // The token never reached the remote repo's files (config, refs, objects).
  const leaked = [];
  const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const f = path.join(d, e.name); if (e.isDirectory()) walk(f); else if (fs.readFileSync(f).includes(FAKE_CREDENTIAL)) leaked.push(f); } };
  walk(bare);
  assert.deepEqual(leaked, []);
  rmQuiet(base);
});

test('publish failures are loud and never print the token', () => {
  const missing = path.join(os.tmpdir(), 'wiki-does-not-exist.git');
  const auth = { mode: 'https-token', source: 'GITHUB_TOKEN', token: FAKE_CREDENTIAL, url: missing };
  assert.throws(() => publish([wikiPagesFromRepo()[0]], { auth, env: process.env }), (error) => {
    assert.match(error.message, /^WIKI_CLONE_FAILED \(https-token, GITHUB_TOKEN\)/);
    assert.ok(!error.message.includes(FAKE_CREDENTIAL));
    return true;
  });
  assert.throws(() => publish([wikiPagesFromRepo()[0]], { auth: { mode: 'none', token: null, url: missing }, env: {} }), /WIKI_TOKEN_MISSING/);
});

test('checkDirtyWiki fails closed when git cannot answer', () => {
  const notRepo = fs.mkdtempSync(path.join(os.tmpdir(), 'wiki-notrepo-'));
  const prev = process.env.GIT_CEILING_DIRECTORIES;
  process.env.GIT_CEILING_DIRECTORIES = path.dirname(notRepo);
  try {
    assert.throws(() => checkDirtyWiki(notRepo));
  } finally {
    if (prev === undefined) delete process.env.GIT_CEILING_DIRECTORIES; else process.env.GIT_CEILING_DIRECTORIES = prev;
    rmQuiet(notRepo);
  }
});

// These run the real script but always with a non-main ref, so they can never
// reach a live publish.
function runScript(args, extraEnv) {
  return spawnSync(process.execPath, [SCRIPT, ...args], {
    encoding: 'utf8',
    env: { ...process.env, GITHUB_ACTIONS: 'true', GITHUB_EVENT_NAME: 'push', WIKI_PUSH_TOKEN: '', GITHUB_TOKEN: '', ...extraEnv }
  });
}

test('cli: a real run from a non-main ref refuses with exit 1 and a clear code', () => {
  const res = runScript([], { GITHUB_REF: 'refs/heads/feature/not-main' });
  assert.equal(res.status, 1);
  assert.match(res.stderr, /REFUSING_WIKI_PUBLISH_BRANCH/);
});

test('cli: --dry-run exits 0 and reports which guards a real run would hit', () => {
  const res = runScript(['--dry-run'], { GITHUB_REF: 'refs/heads/feature/not-main' });
  assert.equal(res.status, 0, res.stderr);
  assert.match(res.stdout, /WIKI_PUBLISH_GUARD: a real run would refuse \(REFUSING_WIKI_PUBLISH_BRANCH\)/);
  assert.match(res.stdout, /WIKI_PUBLISH_DRY_RUN/);
  assert.match(res.stdout, /WIKI_PUBLISH_AUTH: none/);
});

test('cli: pull request events are refused for a real run', () => {
  const res = runScript([], { GITHUB_REF: 'refs/pull/9/merge', GITHUB_EVENT_NAME: 'pull_request' });
  assert.equal(res.status, 1);
  assert.match(res.stderr, /REFUSING_WIKI_PUBLISH_EVENT/);
});

test('workflow: live publish is its own main-only job with contents: write, no continue-on-error, and push diff inputs', () => {
  const yml = fs.readFileSync(path.resolve(path.dirname(SCRIPT), '..', '.github', 'workflows', 'documentation.yml'), 'utf8');
  const [top, rest] = yml.split(/^jobs:\s*$/m);
  assert.match(top, /permissions:\s*\n\s+contents: read/, 'workflow default stays read-only');
  const job = rest.slice(rest.indexOf('  publish-wiki:'));
  assert.ok(job.includes('  publish-wiki:'));
  assert.match(job, /needs: build/);
  assert.match(job, /if: github\.event_name == 'push' && github\.ref == 'refs\/heads\/main'/);
  assert.match(job, /permissions:\s*\n\s+contents: write/);
  assert.match(job, /persist-credentials: false/);
  assert.match(job, /WIKI_PUSH_TOKEN: \$\{\{ secrets\.WIKI_PUSH_TOKEN \}\}/);
  assert.match(job, /GITHUB_TOKEN: \$\{\{ github\.token \}\}/);
  assert.match(job, /WIKI_DIFF_BASE: \$\{\{ github\.event\.before \}\}/);
  assert.match(job, /WIKI_DIFF_HEAD: \$\{\{ github\.sha \}\}/);
  assert.ok(!/continue-on-error/.test(yml), 'no step may hide failures');
  assert.ok(!/git@github\.com/.test(yml));
  assert.match(top, /cancel-in-progress: \$\{\{ github\.ref != 'refs\/heads\/main' \}\}/);
});