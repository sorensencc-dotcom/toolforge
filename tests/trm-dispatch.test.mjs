import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  fetchCards, preflight, buildCommand, buildResume, fillTemplate, codexRulesContent, agySettings,
  runFlow, writeReceipt, parseCriteria, resolveRepo, parseArgs, CLI_PATHS, finalizeAfterVerify, Refusal
} from '../scripts/trm-dispatch.mjs';
import { checkRun, resolveScopedTestCmd } from '../scripts/trm-dispatch-checker.mjs';

const CARD_MD = `# Card\n## Context\nctx\n## Acceptance Criteria\n- [ ] Watchdog restarts daemon within 60s\n- [ ] Logs each restart to trm_history\n`;
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'trmd-'));

function baseCard(over = {}) {
  return {
    id: 'ACT-SIGIL-X', title: 'Watchdog', intent: 'add watchdog', status: 'IN_PROGRESS',
    issue_url: 'https://github.com/o/sigil/issues/153', pr_branch: 'trm/ACT-SIGIL-X', pr_url: null,
    repo: 'sigil', domain: 'SIGIL', target: 'sigil', target_notebook_name: '', category: 'ACT',
    archived_path: null, ...over
  };
}
function env(card, extra = {}) {
  const dir = tmp();
  const cardPath = path.join(dir, 'card.md');
  fs.writeFileSync(cardPath, extra.md ?? CARD_MD);
  const c = { ...card, archived_path: card.archived_path === undefined ? cardPath : (card.archived_path ?? cardPath) };
  return {
    cardId: c.id, cli: extra.cli ?? 'codex',
    fetchImpl: async () => ({ ok: true, json: async () => ({ status: 'ok', count: 1, cards: [c, ...(extra.more || [])] }) }),
    repoDirs: { sigil: dir, toolforge: dir, 'kb-sync': dir, 'rewrite-mcp': dir },
    worktreeRoot: path.join(dir, 'wt'),
    git: extra.git ?? ((args) => (args[0] === 'rev-parse' ? { code: 0, out: 'abc' } : { code: 0, out: '' })),
    exists: extra.exists ?? (() => true),
  };
}
const refuses = async (p, code) => assert.rejects(p, (e) => { assert.equal(e.code, code); return true; });

test('ICF lookup uses refresh=1 and exact-case id', async () => {
  let url;
  const cards = await fetchCards({ fetchImpl: async (u) => { url = u; return { ok: true, json: async () => ({ cards: [{ id: 'A' }, { id: 'a' }] }) }; } });
  assert.match(url, /\/api\/reporting\/trm-backlog\?refresh=1$/);
  assert.equal(cards.length, 2);
  const e = env(baseCard(), { more: [baseCard({ id: 'act-sigil-x', status: 'DONE' })] });
  const ctx = await preflight(e);
  assert.equal(ctx.card.id, 'ACT-SIGIL-X');
});

test('refusal ICF_DOWN', async () => {
  const e = env(baseCard()); e.fetchImpl = async () => { throw new Error('ECONNREFUSED'); };
  await refuses(preflight(e), 'ICF_DOWN');
});
test('refusal NOT_FOUND', async () => { const e = env(baseCard()); e.cardId = 'act-sigil-x'; await refuses(preflight(e), 'NOT_FOUND'); });
test('refusal NOT_ELIGIBLE: status, branch, pr_url', async () => {
  await refuses(preflight(env(baseCard({ status: 'PENDING' }))), 'NOT_ELIGIBLE');
  await refuses(preflight(env(baseCard({ pr_branch: '' }))), 'NOT_ELIGIBLE');
  await refuses(preflight(env(baseCard({ pr_url: 'https://github.com/o/sigil/pull/1' }))), 'NOT_ELIGIBLE');
});
test('refusal NO_ISSUE', async () => { await refuses(preflight(env(baseCard({ issue_url: '' }))), 'NO_ISSUE'); });
test('refusal REPO_AMBIGUOUS', async () => {
  await refuses(preflight(env(baseCard({ repo: 'toolforge' }))), 'REPO_AMBIGUOUS');
  await refuses(preflight(env(baseCard({ target_notebook_name: 'REWRITE-MCP' }))), 'REPO_AMBIGUOUS');
  assert.equal(resolveRepo(baseCard({ domain: 'SIGIL', target: 'Watchdog daemon' })).repo, 'sigil');
});
test('refusal NO_CRITERIA (empty or placeholder)', async () => {
  await refuses(preflight(env(baseCard(), { md: '# c\n## Context\nx\n' })), 'NO_CRITERIA');
  await refuses(preflight(env(baseCard(), { md: '## Acceptance Criteria\n- [ ] TBD\n- [ ] tests pass\n' })), 'NO_CRITERIA');
  assert.deepEqual(parseCriteria(CARD_MD), ['Watchdog restarts daemon within 60s', 'Logs each restart to trm_history']);
});
test('refusal NO_BRANCH, DIRTY_WORKTREE, CLI_MISSING', async () => {
  await refuses(preflight(env(baseCard(), { git: (a) => (a[0] === 'rev-parse' ? { code: 1, out: '' } : { code: 0, out: '' }) })), 'NO_BRANCH');
  await refuses(preflight(env(baseCard(), { git: (a) => (a[0] === 'status' ? { code: 0, out: ' M x.js' } : { code: 0, out: 'abc' }) })), 'DIRTY_WORKTREE');
  await refuses(preflight(env(baseCard(), { exists: (p) => p !== CLI_PATHS.codex })), 'CLI_MISSING');
});

const ctxFor = async (cli) => preflight(env(baseCard(), { cli }));
const FORBIDDEN_FLAGS = /dangerously|skip-permissions|allow-all|bypass|danger-full-access|yolo/i;

test('codex argv is default and sandboxed with rules file', async () => {
  assert.equal(parseArgs(['ACT-1']).cli, 'codex');
  const c = buildCommand(await ctxFor('codex'));
  assert.equal(c.cmd, CLI_PATHS.codex);
  for (const f of ['exec', '--sandbox', 'workspace-write', 'approval_policy="never"', 'model_reasoning_effort="medium"', 'sandbox_workspace_write.network_access=false', '--json']) assert.ok(c.args.includes(f), f);
  const rules = codexRulesContent();
  for (const p of ['"git", "push"', '"git", "remote"', '"gh"', '"curl"', '"wget"', '"npm", "install"', '"pnpm", "add"', '"schtasks"']) assert.ok(rules.includes(p), p);
  assert.match(rules, /decision="forbidden"/);
  assert.ok(Object.keys(c.files).some((f) => f.endsWith(path.join('.codex', 'rules', 'trm.rules'))));
  assert.ok(Object.keys(c.files).some((f) => f.endsWith('AGENTS.override.md')));
});
test('claude/grok/copilot/agy argv carry allow and deny lists', async () => {
  const cl = buildCommand(await ctxFor('claude'));
  assert.deepEqual(cl.args.slice(0, 7), ['-p', '--model', 'sonnet', '--effort', 'medium', '--permission-mode', 'dontAsk']);
  assert.ok(cl.args[cl.args.indexOf('--disallowedTools') + 1].includes('Bash(git commit:*)'));
  assert.ok(!cl.args[cl.args.indexOf('--allowedTools') + 1].includes('Bash(git commit:*)'));
  assert.ok(cl.args[cl.args.indexOf('--disallowedTools') + 1].includes('Bash(git push:*)'));
  const g = buildCommand(await ctxFor('grok'));
  assert.ok(g.args.includes('--deny') && g.args.includes('Bash(git push:*)') && g.args.includes('--disable-web-search'));
  const cp = buildCommand(await ctxFor('copilot'));
  assert.ok(cp.args.includes('--no-ask-user') && cp.args.includes('shell(git push)') && cp.args.includes('--deny-url'));
  const a = buildCommand(await ctxFor('agy'));
  assert.equal(a.cmd, 'C:\\Users\\soren\\AppData\\Local\\agy\\bin\\agy.exe');
  const sf = a.args[a.args.indexOf('--settings') + 1];
  const s = JSON.parse(a.files[sf]);
  assert.ok(s.permissions.deny.some((r) => /git.*push/.test(r)));
  assert.deepEqual(s, agySettings());
});
test('no CLI argv has bypass flags or push/merge', async () => {
  for (const cli of ['codex', 'claude', 'grok', 'copilot', 'agy']) {
    const c = buildCommand(await ctxFor(cli));
    for (const a of c.args) {
      assert.doesNotMatch(a, FORBIDDEN_FLAGS, `${cli}: ${a}`);
      assert.ok(!/^(git )?(push|merge)\b/.test(a), `${cli}: ${a}`);
    }
  }
});
test('brief fills every placeholder', async () => {
  const ctx = await ctxFor('codex');
  const brief = ctx.brief;
  assert.doesNotMatch(brief, /\{\{/);
  assert.match(brief, /Watchdog restarts daemon within 60s/);
  assert.match(brief, /closes #153/);
  assert.throws(() => fillTemplate('{{A}} {{B}}', { A: 1 }), /B/);
});

const GOOD_DONE = `## Criterion: Watchdog restarts daemon within 60s\nStatus: MET\nCommand: node --test\nOutput: ok 1\n\n## Criterion: Logs each restart to trm_history\nStatus: MET\nCommand: node --test\nOutput: ok 2\n`;
const CRIT = ['Watchdog restarts daemon within 60s', 'Logs each restart to trm_history'];
const goodEv = (o = {}) => ({
  doneMd: GOOD_DONE, criteria: CRIT, test: { code: 0, output: '# tests 4\n# pass 4\n# skipped 0\n# todo 0' }, baseTests: 3,
  nameStatus: 'A\ttests/w.test.mjs\nA\tsrc/w.mjs', addedLines: ['const x = 1;'],
  commits: [{ sha: 'a', files: ['tests/w.test.mjs'] }, { sha: 'b', files: ['src/w.mjs'] }], ...o
});
const gapsOf = (o) => checkRun(goodEv(o)).gaps.join('\n');

test('checker passes good evidence', () => { assert.deepEqual(checkRun(goodEv()), { ok: true, gaps: [], info: [] }); });
test('checker rejections', () => {
  assert.match(gapsOf({ doneMd: null }), /DONE\.md missing/);
  assert.match(gapsOf({ doneMd: GOOD_DONE.replace('Status: MET', 'Status: NOT MET') }), /NOT MET/);
  assert.match(gapsOf({ doneMd: GOOD_DONE.split('\n\n')[0] }), /no block.*Logs each restart/);
  assert.match(gapsOf({ doneMd: GOOD_DONE.replace('Output: ok 1', '') }), /Command\/Output/);
  assert.match(gapsOf({ test: { code: 1, output: 'not ok 1' } }), /tests failed/);
  assert.match(gapsOf({ test: { code: 0, output: '# tests 4\n# skipped 1\n# todo 0' } }), /skipped/);
  assert.match(gapsOf({ test: { code: 0, output: '# tests 2\n# skipped 0\n# todo 0' } }), /test count dropped/);
  assert.match(gapsOf({ nameStatus: 'D\ttests/old.test.mjs' }), /deleted test file/);
  for (const bad of ['// TODO later', 'FIXME', 'it.skip(', 'test.only(', 'assert True', "throw new Error('not implemented')"]) assert.match(gapsOf({ addedLines: [bad] }), /forbidden pattern/, bad);
  assert.match(gapsOf({ nameStatus: 'M\t_status-feed/x.json' }), /protected path/);
});

test('flow: pass -> VERIFIED; fail twice -> resume once then NEEDS_HUMAN', async () => {
  const ctx = await ctxFor('codex');
  const calls = [];
  const runner = async (cmd) => { calls.push(cmd); return { code: 0, sessionId: 'sess-1' }; };
  let r = await runFlow({ ctx, runner, check: async () => ({ ok: true, gaps: [] }), writeFile: () => {} });
  assert.equal(r.status, 'VERIFIED'); assert.equal(r.resumed, false); assert.equal(calls.length, 1);
  calls.length = 0; const written = {};
  r = await runFlow({ ctx, runner, check: async () => ({ ok: false, gaps: ['tests failed'] }), writeFile: (p, c) => { written[p] = c; } });
  assert.equal(r.status, 'NEEDS_HUMAN'); assert.equal(r.resumed, true); assert.equal(calls.length, 2);
  assert.deepEqual(calls[1].args.slice(2, 5), ['exec', 'resume', 'sess-1']);
  assert.match(Object.entries(written).find(([p]) => p.endsWith('gaps.md'))[1], /Fix only these gaps/);
  let n = 0;
  r = await runFlow({ ctx, runner, check: async () => (n++ ? { ok: true, gaps: [] } : { ok: false, gaps: ['x'] }), writeFile: () => {} });
  assert.equal(r.status, 'VERIFIED'); assert.equal(r.resumed, true);
});

test('receipt shape written to injected dir', () => {
  const dir = tmp();
  writeReceipt(dir, { card_id: 'A', cli: 'codex', status: 'VERIFIED' });
  const s = JSON.parse(fs.readFileSync(path.join(dir, 'trm_dispatch_status.json'), 'utf8'));
  for (const k of ['card_id', 'cli', 'model', 'effort', 'branch', 'worktree', 'status', 'pr_url', 'tests', 'criteria_met', 'criteria_total', 'session_id', 'resumed', 'gaps', 'started_at', 'ended_at', 'log']) assert.ok(k in s.A, k);
  assert.equal(fs.readFileSync(path.join(dir, 'trm_history', 'dispatch', 'ledger.jsonl'), 'utf8').trim().split('\n').length, 1);
});

test('dry-run spawns nothing and writes nothing', async () => {
  const { dispatch } = await import('../scripts/trm-dispatch.mjs');
  const e = env(baseCard()); const out = [];
  let spawned = 0, wrote = 0;
  const r = await dispatch({ ...e, dryRun: true, runner: async () => { spawned++; }, writeFile: () => { wrote++; }, log: (l) => out.push(l) });
  assert.equal(spawned, 0); assert.equal(wrote, 0); assert.equal(r.status, 'DRY_RUN');
  const text = out.join('\n');
  for (const k of ['repo:', 'branch:', 'worktree:', 'argv:', 'prompt_chars:']) assert.match(text, new RegExp(k));
});

test('preflight never throws a bare TypeError when the template cannot be read (ctx-building caller)', async () => {
  const dir = tmp();
  const cardPath = path.join(dir, 'card.md');
  fs.writeFileSync(cardPath, CARD_MD);
  const card = baseCard({ archived_path: cardPath });
  const opts = {
    cardId: card.id,
    fetchImpl: async () => ({ ok: true, json: async () => ({ cards: [card] }) }),
    repoDirs: { sigil: dir },
    worktreeRoot: path.join(dir, 'wt'),
    git: (args) => (args[0] === 'rev-parse' ? { code: 0, out: 'abc' } : { code: 0, out: '' }),
    exists: () => true,
    readFile: (p) => (p === cardPath ? fs.readFileSync(p, 'utf8') : undefined),
  };
  await assert.doesNotReject(preflight(opts), TypeError);
});

test('finalizeAfterVerify never throws a bare TypeError on a card missing target/intent and on git returning no out', () => {
  const ctx = {
    card: { id: 'ACT-X', title: 'Some title' }, // no target, intent, category, direction, action_type
    repo: undefined, worktree: '/tmp/doesnotmatter', branch: 'trm/ACT-X', issueNum: 42,
  };
  const git = () => ({ code: 0 }); // no `out` on any call, incl. status
  const gh = () => ({ code: 0 }); // no `out`
  assert.throws(() => finalizeAfterVerify(ctx, { git, gh }), (e) => {
    assert.ok(!(e instanceof TypeError), `expected a Refusal, got ${e.constructor.name}: ${e.message}`);
    assert.ok(e instanceof Refusal);
    return true;
  });
});

test('finalizeAfterVerify never throws a bare TypeError when gh returns no out on success', () => {
  const ctx = {
    card: { id: 'ACT-X', title: 'Some title' },
    repo: undefined, worktree: '/tmp/doesnotmatter', branch: 'trm/ACT-X', issueNum: 42,
  };
  const git = (args) => (args[0] === 'status' ? { code: 0, out: ' M src/file.js' } : { code: 0 });
  const gh = () => ({ code: 0 }); // success, but no `out` to parse a pr_url from
  const r = finalizeAfterVerify(ctx, { git, gh });
  assert.equal(r.pr_url, null);
});

test('parseArgs reads flags and rejects unknown cli', () => {
  const o = parseArgs(['ACT-1', '--cli', 'claude', '--model', 'opus', '--effort', 'high', '--timeout-min', '10', '--dry-run']);
  assert.deepEqual(o, { cli: 'claude', effort: 'high', timeoutMin: 10, dryRun: true, model: 'opus', cardId: 'ACT-1' });
  assert.throws(() => parseArgs(['ACT-1', '--cli', 'nope']), /BAD_ARGS/);
});

test('codex pins windows.sandbox=mxc per run (first run and resume), overridable', async () => {
  const ctx = await ctxFor('codex');
  const c = buildCommand(ctx);
  assert.deepEqual(c.args.slice(0, 3), ['-c', 'windows.sandbox=mxc', 'exec']);
  assert.ok(c.args.includes('workspace-write'));
  assert.ok(!c.args.some((a) => /danger-full-access|dangerously/.test(a)));
  const r = buildResume(ctx, { ...c, sessionId: 'S1' }, 'gaps.md');
  assert.deepEqual(r.args.slice(0, 3), ['-c', 'windows.sandbox=mxc', 'exec']);
  const u = buildCommand({ ...ctx, codexWindowsSandbox: 'unelevated' });
  assert.deepEqual(u.args.slice(0, 2), ['-c', 'windows.sandbox=unelevated']);
  assert.throws(() => buildCommand({ ...ctx, codexWindowsSandbox: 'bogus"x' }));
});

test('brief tells CLI to leave changes uncommitted and shows exact DONE.md Criterion format', async () => {
  const ctx = await ctxFor('codex');
  assert.match(ctx.brief, /leave (all )?changes uncommitted|do not (git )?(add|commit)|uncommitted/i);
  assert.doesNotMatch(ctx.brief, /Commit tests alone|Commit: `\{\{COMMIT_TYPE\}\}/);
  assert.match(ctx.brief, /## Criterion: <exact criterion text>/);
  assert.match(ctx.brief, /Status: MET \| NOT MET/);
  const c = buildCommand(ctx);
  // codex rules / allow must not permit commit
  const rules = Object.values(c.files).find((v) => typeof v === 'string' && v.includes('prefix_rule'));
  assert.match(rules, /pattern=\["git", "commit"\].*forbidden|forbidden.*"git", "commit"/s);
});

test('checker accepts ## Criterion: blocks and ignores missing commits (dispatcher commits later)', () => {
  const done = `## Criterion: Watchdog restarts daemon within 60s\nStatus: MET\nEvidence: a.mjs\nCommand: node --test tests/w.test.mjs\nOutput: # tests 1\\n# pass 1\n\n## Criterion: Logs each restart to trm_history\nStatus: MET\nEvidence: a.mjs\nCommand: node --test tests/w.test.mjs\nOutput: # tests 1\\n# pass 1\n`;
  const r = checkRun({
    doneMd: done, criteria: CRIT,
    test: { code: 0, output: '# tests 1\n# pass 1\n# skipped 0\n# todo 0' },
    nameStatus: 'A\ttests/w.test.mjs\nA\tsrc/w.mjs', addedLines: ['const x = 1;'],
    commits: [],
  });
  assert.deepEqual(r.gaps, []);
  assert.equal(r.ok, true);
});

test('checker DONE.md parser requires ## Criterion: <exact text> (rejects ### heading)', () => {
  const bad = `### Watchdog restarts daemon within 60s\nStatus: MET\nCommand: node --test\nOutput: ok\n\n### Logs each restart to trm_history\nStatus: MET\nCommand: node --test\nOutput: ok\n`;
  assert.match(checkRun({ doneMd: bad, criteria: CRIT, test: { code: 0, output: '# tests 1\n# pass 1\n# skipped 0\n# todo 0' }, nameStatus: '', addedLines: [], commits: [] }).gaps.join('\n'), /no block/);
});

test('resolveScopedTestCmd prefers card test files over npm test; full suite info only', async () => {
  const cmd = resolveScopedTestCmd({
    testCmd: 'npm test',
    nameStatus: 'A\ttests/chief-watchdog.test.mjs\nA\tscripts/chief-watchdog.ps1',
  });
  assert.match(cmd, /node --test/);
  assert.match(cmd, /chief-watchdog\.test\.mjs/);
  assert.doesNotMatch(cmd, /^npm test$/);
  const r = checkRun({
    doneMd: GOOD_DONE, criteria: CRIT,
    test: { code: 0, output: '# tests 3\n# pass 3\n# skipped 0\n# todo 0' },
    nameStatus: 'A\ttests/w.test.mjs', addedLines: [], commits: [],
    fullSuite: { code: 1, output: 'Error: Cannot find package canonicalize' },
  });
  assert.equal(r.ok, true);
  assert.ok((r.info || []).some((i) => /pre-existing|info only|canonicalize/i.test(i)));
});


test('dispatch after VERIFIED commits+pushes+opens draft PR; skips commit when checker fails', async () => {
  const { dispatch } = await import('../scripts/trm-dispatch.mjs');
  const e = env(baseCard());
  const wt = path.join(e.worktreeRoot, 'act-sigil-x');
  const gitCalls = [];
  const ghCalls = [];
  let phase = 'pre';
  const git = (args) => {
    gitCalls.push(args);
    if (args[0] === 'rev-parse' && args.includes('--verify')) return { code: 0, out: '' };
    if (args[0] === 'rev-parse' && args.includes('--git-path')) return { code: 0, out: path.join(wt, '.git', 'info', 'exclude') };
    if (args[0] === 'status' && args.includes('--porcelain')) {
      if (phase === 'pre') return { code: 0, out: '' };
      return { code: 0, out: '?? scripts/w.ps1\n?? tests/w.test.mjs\n' };
    }
    if (args[0] === 'worktree') return { code: 0, out: '' };
    return { code: 0, out: '' };
  };
  phase = 'pre';
  gitCalls.length = 0; ghCalls.length = 0;
  const pass = await dispatch({
    ...e, git,
    runner: async () => { phase = 'post'; return { code: 0, sessionId: 's1' }; },
    check: async () => ({ ok: true, gaps: [] }),
    writeFile: () => {},
    statusDir: tmp(),
    gh: (args) => { ghCalls.push(args); return { code: 0, out: 'https://github.com/o/sigil/pull/1\n' }; },
    log: () => {},
  });
  assert.equal(pass.status, 'PR_OPEN');
  assert.ok(gitCalls.some((a) => a[0] === 'commit'), 'expected git commit after pass');
  assert.ok(gitCalls.some((a) => a[0] === 'push'), 'expected git push after pass');
  assert.ok(ghCalls.some((a) => a.includes('pr') && a.includes('create')), 'expected gh pr create');
  assert.match(pass.pr_url || '', /pull\/1/);

  phase = 'pre';
  gitCalls.length = 0; ghCalls.length = 0;
  const fail = await dispatch({
    ...e, git,
    runner: async () => { phase = 'post'; return { code: 0, sessionId: 's1' }; },
    check: async () => ({ ok: false, gaps: ['x'] }),
    writeFile: () => {},
    statusDir: tmp(),
    gh: (args) => { ghCalls.push(args); return { code: 0, out: '' }; },
    log: () => {},
  });
  assert.equal(fail.status, 'NEEDS_HUMAN');
  assert.ok(!gitCalls.some((a) => a[0] === 'commit'), 'no commit on fail');
  assert.ok(!gitCalls.some((a) => a[0] === 'push'), 'no push on fail');
  assert.equal(ghCalls.length, 0);
});
