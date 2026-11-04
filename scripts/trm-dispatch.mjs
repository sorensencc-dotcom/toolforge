#!/usr/bin/env node
// Hands one promoted TRM card (from ICF) to a coding CLI, verifies the run, resumes once, writes a receipt.
// Spec: docs/trm-dispatch/SPEC.md. No push, no PR, no ICF writes.
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { commitTypeForCard } from './trm-promote-card.mjs';
import { checkRun, gatherEvidence } from './trm-dispatch-checker.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ICF_URL = 'http://127.0.0.1:8080/api/reporting/trm-backlog?refresh=1';
const HOME = process.env.USERPROFILE || 'C:\\Users\\soren';
export const CLI_PATHS = {
  codex: path.join(process.env.APPDATA || path.join(HOME, 'AppData', 'Roaming'), 'npm', 'codex.cmd'),
  claude: path.join(HOME, '.local', 'bin', 'claude.exe'),
  grok: path.join(HOME, '.grok', 'bin', 'grok.exe'),
  copilot: process.env.TRM_COPILOT_PATH || 'copilot',
  agy: 'C:\\Users\\soren\\AppData\\Local\\agy\\bin\\agy.exe'
};
export const DEFAULT_REPO_DIRS = {
  toolforge: 'C:\\dev', icf: 'C:\\dev\\icf', 'kb-sync': 'C:\\dev\\kb-sync', sigil: 'C:\\dev\\sigil-repo',
  'rewrite-mcp': 'C:\\dev\\rewrite-mcp', 'rewrite-docs': 'C:\\dev\\rewrite-docs',
  ironledger: 'C:\\dev\\IronLedger', 'personal-os': 'C:\\dev\\personal-os'
};
const ALIASES = { rewrite: 'rewrite-mcp', 'sigil-repo': 'sigil', rewritemcp: 'rewrite-mcp', kbsync: 'kb-sync' };
const PLACEHOLDER = /^(tbd|todo|n\/?a|none|tests pass|all tests pass|works|done|\.\.\.|-)$/i;
const DEFAULT_TEMPLATE = path.join(__dirname, 'trm-dispatch', 'codex-brief.template.md');
export const STATUS_DIR = 'C:\\dev\\_status-feed';

export class Refusal extends Error {
  constructor(code, message) { super(`${code}: ${message}`); this.code = code; }
}

export function parseArgs(argv) {
  const o = { cli: 'codex', effort: 'medium', timeoutMin: 45, dryRun: false, model: null, cardId: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--cli') o.cli = argv[++i];
    else if (a === '--model') o.model = argv[++i];
    else if (a === '--effort') o.effort = argv[++i];
    else if (a === '--timeout-min') o.timeoutMin = Number(argv[++i]);
    else if (a === '--dry-run') o.dryRun = true;
    else if (!o.cardId) o.cardId = a;
  }
  if (!CLI_PATHS[o.cli]) throw new Refusal('BAD_ARGS', `unknown --cli ${o.cli}`);
  return o;
}

export async function fetchCards({ fetchImpl = globalThis.fetch, url = ICF_URL } = {}) {
  let body;
  try {
    const res = await fetchImpl(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    body = await res.json();
  } catch (e) {
    throw new Refusal('ICF_DOWN', `ICF backlog unreachable at ${url} (${e.message}); no file fallback`);
  }
  if (!Array.isArray(body?.cards)) throw new Refusal('ICF_DOWN', 'ICF response has no cards[]');
  return body.cards;
}

const norm = (v) => {
  if (!v) return null;
  const k = String(v).trim().toLowerCase().split('/').pop();
  return ALIASES[k] || k;
};
const repoOfUrl = (u) => (String(u || '').match(/github\.com\/[^/]+\/([^/#?]+)/) || [])[1] || null;

export function resolveRepo(card, known = DEFAULT_REPO_DIRS) {
  const issueRepo = norm(repoOfUrl(card.issue_url));
  const cardRepo = norm(card.repo);
  const chosen = issueRepo || cardRepo;
  const hints = { issue_url: card.issue_url, repo: card.repo, domain: card.domain, target: card.target, target_notebook_name: card.target_notebook_name };
  const bad = (why) => new Refusal('REPO_AMBIGUOUS', `${why}; values ${JSON.stringify(hints)}`);
  if (issueRepo && cardRepo && issueRepo !== cardRepo) throw bad(`issue repo ${issueRepo} != card repo ${cardRepo}`);
  for (const f of ['domain', 'target', 'target_notebook_name']) {
    const n = norm(card[f]);
    if (n && n in known && n !== chosen) throw bad(`${f} names ${n}, not ${chosen}`);
  }
  if (!chosen) throw bad('no repo on card');
  const issueNum = Number((String(card.issue_url).match(/\/issues\/(\d+)/) || [])[1]) || null;
  return { repo: chosen, issueNum };
}

function section(md, re) {
  const parts = md.split(/^(?=#{1,6} )/m);
  const p = parts.find((x) => re.test(x.split('\n')[0]));
  return p ? p.split('\n').slice(1).join('\n').trim() : '';
}

export function parseCriteria(md) {
  return section(md, /acceptance|finish criteria|done when/i)
    .split('\n')
    .map((l) => l.match(/^\s*(?:[-*]|\d+\.)\s+(?:\[[ xX]\]\s*)?(.+?)\s*$/))
    .filter(Boolean)
    .map((m) => m[1]);
}

export function fillTemplate(tpl, vars) {
  const out = tpl.replace(/\{\{([A-Z_]+)\}\}/g, (all, k) => (k in vars ? String(vars[k]) : all));
  const left = [...new Set(out.match(/\{\{[A-Z_]+\}\}/g) || [])];
  if (left.length) throw new Error(`unfilled placeholders: ${left.join(', ')}`);
  return out;
}

const defaultGit = (args, cwd) => {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8' });
  return { code: r.status ?? 1, out: (r.stdout || '').trim() };
};
const defaultExists = (p) => {
  if (path.isAbsolute(p)) return fs.existsSync(p);
  return spawnSync(process.platform === 'win32' ? 'where' : 'which', [p]).status === 0;
};

export async function preflight(opts) {
  const {
    cardId, cli = 'codex', fetchImpl, repoDirs = DEFAULT_REPO_DIRS, worktreeRoot = 'C:\\dev\\.worktrees',
    git = defaultGit, exists = defaultExists, readFile = (p) => fs.readFileSync(p, 'utf8'),
    templatePath = DEFAULT_TEMPLATE, testCmd = 'npm test', model = null, effort = 'medium'
  } = opts;
  const cards = await fetchCards({ fetchImpl });
  const card = cards.find((c) => c.id === cardId);
  if (!card) throw new Refusal('NOT_FOUND', `no ICF card with id ${cardId} (exact case)`);
  if (card.status !== 'IN_PROGRESS' || !card.pr_branch || card.pr_url) {
    throw new Refusal('NOT_ELIGIBLE', `need IN_PROGRESS + pr_branch + no pr_url (status=${card.status}, pr_branch=${card.pr_branch || ''}, pr_url=${card.pr_url || ''}); stage it in ICF first`);
  }
  if (!card.issue_url) throw new Refusal('NO_ISSUE', 'card has no issue_url');
  const { repo, issueNum } = resolveRepo(card, repoDirs);
  const md = card.archived_path && exists(card.archived_path) ? readFile(card.archived_path) : '';
  const criteria = parseCriteria(md).filter((c) => !PLACEHOLDER.test(c));
  if (!criteria.length) throw new Refusal('NO_CRITERIA', `no real acceptance criteria in ${card.archived_path || '(no archived_path)'}`);
  const cliPath = CLI_PATHS[cli];
  if (!cliPath || !exists(cliPath)) throw new Refusal('CLI_MISSING', `${cli} not found at ${cliPath}`);
  const repoDir = repoDirs[repo];
  if (!repoDir) throw new Refusal('REPO_AMBIGUOUS', `no local dir for repo ${repo}`);
  const branch = card.pr_branch;
  if (git(['rev-parse', '--verify', '--quiet', `refs/heads/${branch}`], repoDir).code !== 0) {
    throw new Refusal('NO_BRANCH', `branch ${branch} not in ${repoDir}`);
  }
  const worktree = path.join(worktreeRoot, card.id.toLowerCase());
  const wtExists = exists(worktree);
  if (wtExists && git(['status', '--porcelain'], worktree).out.trim()) {
    throw new Refusal('DIRTY_WORKTREE', `${worktree} has uncommitted changes`);
  }
  const target = String(card.target || repo).toLowerCase().replace(/[^a-z0-9-]+/g, '-');
  const intent = String(card.intent || card.title || card.id).trim();
  const scope = section(md, /technical scope|scope/i) || 'Files needed to meet the criteria below.';
  const brief = fillTemplate(readFile(templatePath), {
    CARD_ID: card.id, TITLE: card.title || card.id, GOAL: intent, ISSUE_URL: card.issue_url, REPO: repo,
    BRANCH: branch, WORKTREE: worktree, SCOPE_FILES: scope.replace(/\n+/g, ' '),
    OUT_OF_SCOPE: section(md, /out of scope/i).replace(/\n+/g, ' ') || 'Anything not needed for the criteria.',
    INSTALL_EXCEPTION: /npm install|pnpm add/i.test(md) ? ' (except installs the card names)' : '',
    CRITERIA_LIST: criteria.map((c) => `- ${c}`).join('\n'), TEST_CMD: testCmd, TARGET: target, INTENT: intent,
    COMMIT_TYPE: commitTypeForCard(card), ISSUE_NUM: issueNum ?? ''
  });
  return { card, cli, cliPath, repo, repoDir, issueNum, branch, worktree, wtExists, criteria, brief, testCmd, model, effort };
}

const ALLOW = ['git status', 'git diff', 'git add', 'git commit', 'git log', 'git show', 'node', 'npm test', 'npm run test', 'pnpm test'];
const DENY = ['git push', 'git remote', 'gh', 'curl', 'wget', 'npm install', 'pnpm add'];
const RULE_PREFIXES = [['git', 'push'], ['git', 'remote'], ['gh'], ['curl'], ['wget'], ['Invoke-WebRequest'], ['npm', 'install'], ['npm', 'i'], ['pnpm', 'add'], ['schtasks'], ['Register-ScheduledTask']];

export function codexRulesContent() {
  return RULE_PREFIXES.map((p) => `prefix_rule(pattern=[${p.map((x) => `"${x}"`).join(', ')}], decision="forbidden", justification="TRM dispatch: no network, push or scheduling")`).join('\n') + '\n';
}

export function agySettings() {
  return {
    permissions: {
      allow: ['command(git status)', 'command(regex:^git (diff|add|commit|log|show)( |$))', 'command(regex:^npm (test|run test))', 'command(regex:^node )'],
      deny: ['command(regex:^git push)', 'command(regex:^git remote)', 'command(regex:^(gh|curl|wget) )', 'command(regex:^npm (install|i) )', 'read_url(*)', 'execute_url(*)']
    }
  };
}

const logPath = (ctx) => path.join(STATUS_DIR, 'trm_history', 'dispatch', `${ctx.card.id}-${ctx.stamp || 'run'}.log`);

export function buildCommand(ctx) {
  const wt = ctx.worktree;
  const brief = path.join(wt, 'AGENTS.override.md');
  const log = ctx.log || logPath(ctx);
  const files = { [brief]: ctx.brief };
  const bashAllow = ALLOW.map((a) => `Bash(${a}:*)`);
  const bashDeny = DENY.map((d) => `Bash(${d}:*)`);
  const effort = ctx.effort || 'medium';
  let args;
  switch (ctx.cli) {
    case 'codex':
      files[path.join(wt, '.codex', 'rules', 'trm.rules')] = codexRulesContent();
      args = ['exec', '-C', wt, '--sandbox', 'workspace-write', '-c', 'approval_policy="never"', '-c', `model_reasoning_effort="${effort}"`,
        '-c', 'sandbox_workspace_write.network_access=false', ...(ctx.model ? ['-m', ctx.model] : []), '--json', '-o', `${log}.last.md`, '-'];
      break;
    case 'claude':
      args = ['-p', '--model', ctx.model || 'sonnet', '--effort', effort, '--permission-mode', 'dontAsk', '--add-dir', wt,
        '--allowedTools', ['Read', 'Edit', 'Write', 'Glob', 'Grep', ...bashAllow, 'Bash(pwsh -File ./*)'].join(','),
        '--disallowedTools', [...bashDeny, 'WebFetch', 'WebSearch'].join(',')];
      break;
    case 'grok':
      args = ['-p', ctx.brief, '--cwd', wt, ...(ctx.model ? ['-m', ctx.model] : []), '--effort', effort, '--permission-mode', 'dontAsk',
        ...bashAllow.flatMap((a) => ['--allow', a]), ...bashDeny.flatMap((d) => ['--deny', d]),
        '--disable-web-search', '--max-turns', '200', '--output-format', 'json'];
      break;
    case 'copilot':
      args = ['-p', ctx.brief, '-C', wt, '-s', '--no-ask-user', '--reasoning-effort', effort, ...(ctx.model ? ['--model', ctx.model] : []),
        '--allow-tool', 'write', ...ALLOW.flatMap((a) => ['--allow-tool', `shell(${a})`]),
        ...DENY.flatMap((d) => ['--deny-tool', `shell(${d})`]), '--deny-url', '*', '--disallow-temp-dir'];
      break;
    case 'agy': {
      const sf = path.join(wt, '.trm-dispatch', 'agy-settings.json');
      files[sf] = JSON.stringify(agySettings(), null, 2);
      args = ['-p', ctx.brief, '--add-dir', wt, '--print-timeout', `${ctx.timeoutMin || 45}m`, '--settings', sf, '--output-format', 'stream-json'];
      break;
    }
    default:
      throw new Refusal('BAD_ARGS', `unknown cli ${ctx.cli}`);
  }
  const stdinFile = ['codex', 'claude'].includes(ctx.cli) ? brief : null;
  return { cmd: ctx.cliPath, args, stdinFile, files, log, cwd: wt };
}

export function buildResume(ctx, first, gapsPath) {
  const c = { ...first, stdinFile: gapsPath };
  const gapsText = `Read ${gapsPath} and fix only those gaps.`;
  switch (ctx.cli) {
    case 'codex':
      c.args = ['exec', 'resume', first.sessionId, '-C', ctx.worktree, '-c', 'approval_policy="never"', '-c', `model_reasoning_effort="${ctx.effort || 'medium'}"`, '--json', '-o', `${first.log}.resume.md`, '-'];
      break;
    case 'claude': c.args = ['-c', ...first.args]; break;
    case 'agy': c.args = ['--continue', ...first.args.map((a) => (a === ctx.brief ? gapsText : a))]; c.stdinFile = null; break;
    default: c.args = ['-c', ...first.args.map((a) => (a === ctx.brief ? gapsText : a))]; c.stdinFile = null;
  }
  return c;
}

export async function runFlow({ ctx, runner, check, writeFile = (p, c) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, c); } }) {
  const cmd = buildCommand(ctx);
  for (const [p, c] of Object.entries(cmd.files)) writeFile(p, c);
  const r1 = await runner(cmd);
  if (r1?.timedOut) return { status: 'TIMEOUT', resumed: false, gaps: ['timed out'], session_id: r1.sessionId || null };
  let res = await check(ctx);
  if (res.ok) return { status: 'VERIFIED', resumed: false, gaps: [], session_id: r1?.sessionId || null };
  if (ctx.cli === 'codex' && !r1?.sessionId) return { status: 'NEEDS_HUMAN', resumed: false, gaps: [...res.gaps, 'no codex session id to resume'], session_id: null };
  const gapsPath = path.join(ctx.worktree, 'gaps.md');
  writeFile(gapsPath, `# Gaps from verifier\n\n${res.gaps.map((g) => `- ${g}`).join('\n')}\n\nFix only these gaps. Same rules as AGENTS.override.md. Update DONE.md.\n`);
  const r2 = await runner(buildResume(ctx, { ...cmd, sessionId: r1?.sessionId }, gapsPath));
  if (r2?.timedOut) return { status: 'TIMEOUT', resumed: true, gaps: ['timed out on resume'], session_id: r1?.sessionId || null };
  res = await check(ctx);
  return { status: res.ok ? 'VERIFIED' : 'NEEDS_HUMAN', resumed: true, gaps: res.gaps, session_id: r1?.sessionId || null };
}

const RECEIPT_KEYS = ['card_id', 'cli', 'model', 'effort', 'branch', 'worktree', 'status', 'pr_url', 'tests', 'criteria_met', 'criteria_total', 'session_id', 'resumed', 'gaps', 'started_at', 'ended_at', 'log'];

export function writeReceipt(dir, data) {
  const rec = Object.fromEntries(RECEIPT_KEYS.map((k) => [k, data[k] ?? (k === 'gaps' ? [] : k === 'resumed' ? false : null)]));
  const statusFile = path.join(dir, 'trm_dispatch_status.json');
  const all = fs.existsSync(statusFile) ? JSON.parse(fs.readFileSync(statusFile, 'utf8')) : {};
  all[rec.card_id] = rec;
  fs.mkdirSync(path.join(dir, 'trm_history', 'dispatch'), { recursive: true });
  fs.writeFileSync(statusFile, JSON.stringify(all, null, 2));
  fs.appendFileSync(path.join(dir, 'trm_history', 'dispatch', 'ledger.jsonl'), JSON.stringify(rec) + '\n');
  return rec;
}

export function realRunner(timeoutMin = 45) {
  return (cmd) => new Promise((resolve) => {
    fs.mkdirSync(path.dirname(cmd.log), { recursive: true });
    const out = fs.createWriteStream(cmd.log, { flags: 'a' });
    const p = spawn(cmd.cmd, cmd.args, { cwd: cmd.cwd, shell: /\.cmd$/i.test(cmd.cmd), windowsHide: true });
    let sessionId = null, buf = '';
    p.stdout.on('data', (d) => {
      out.write(d); buf += d;
      const m = buf.match(/"type":"thread\.started"[^}]*"thread_id":"([^"]+)"/);
      if (m) sessionId = m[1];
    });
    p.stderr.on('data', (d) => out.write(d));
    if (cmd.stdinFile) fs.createReadStream(cmd.stdinFile).pipe(p.stdin); else p.stdin.end();
    const t = setTimeout(() => { p.kill(); resolve({ code: null, timedOut: true, sessionId }); }, timeoutMin * 60000);
    p.on('close', (code) => { clearTimeout(t); out.end(); resolve({ code, sessionId, timedOut: false }); });
  });
}

function prepareWorktree(ctx, git = defaultGit) {
  if (!ctx.wtExists) {
    const r = git(['worktree', 'add', ctx.worktree, ctx.branch], ctx.repoDir);
    if (r.code !== 0) throw new Refusal('ERROR', `git worktree add failed: ${r.out}`);
  }
  const exclude = path.resolve(ctx.worktree, git(['rev-parse', '--git-path', 'info/exclude'], ctx.worktree).out);
  const have = fs.existsSync(exclude) ? fs.readFileSync(exclude, 'utf8') : '';
  const add = ['AGENTS.override.md', 'DONE.md', 'gaps.md', '.codex/', '.trm-dispatch/'].filter((e) => !have.split('\n').includes(e));
  if (add.length) fs.appendFileSync(exclude, `\n${add.join('\n')}\n`);
  const lock = path.join(ctx.worktree, '.trm-dispatch', 'lock');
  if (fs.existsSync(lock)) throw new Refusal('ERROR', `dispatch already running for ${ctx.card.id} (${lock})`);
  fs.mkdirSync(path.dirname(lock), { recursive: true });
  fs.writeFileSync(lock, String(process.pid));
  return lock;
}

export async function dispatch(opts) {
  const log = opts.log || console.log;
  const ctx = await preflight(opts);
  ctx.stamp = new Date().toISOString().replace(/[:.]/g, '-');
  ctx.timeoutMin = opts.timeoutMin || 45;
  const cmd = buildCommand(ctx);
  if (opts.dryRun) {
    log(`card: ${ctx.card.id}`);
    log(`repo: ${ctx.repo} (${ctx.repoDir}) issue #${ctx.issueNum}`);
    log(`branch: ${ctx.branch}`);
    log(`worktree: ${ctx.worktree}${ctx.wtExists ? ' (exists, clean)' : ' (would be created)'}`);
    log(`criteria: ${ctx.criteria.length}`);
    log(`argv: ${JSON.stringify([cmd.cmd, ...cmd.args])}${cmd.stdinFile ? ` < ${cmd.stdinFile}` : ''}`);
    log(`files: ${Object.keys(cmd.files).join(', ')}`);
    log(`prompt_chars: ${ctx.brief.length}`);
    return { status: 'DRY_RUN', ctx, cmd };
  }
  const started = new Date().toISOString();
  const lock = prepareWorktree(ctx, opts.git);
  try {
    const check = async () => checkRun(gatherEvidence({ worktree: ctx.worktree, criteria: ctx.criteria, testCmd: ctx.testCmd }));
    const r = await runFlow({ ctx, runner: opts.runner || realRunner(ctx.timeoutMin), check, writeFile: opts.writeFile });
    const rec = writeReceipt(opts.statusDir || STATUS_DIR, {
      card_id: ctx.card.id, cli: ctx.cli, model: ctx.model, effort: ctx.effort, branch: ctx.branch, worktree: ctx.worktree,
      status: r.status, tests: r.gaps.some((g) => g.startsWith('tests failed')) ? 'FAIL' : 'PASS',
      criteria_total: ctx.criteria.length, criteria_met: r.status === 'VERIFIED' ? ctx.criteria.length : null,
      session_id: r.session_id, resumed: r.resumed, gaps: r.gaps, started_at: started, ended_at: new Date().toISOString(), log: cmd.log
    });
    log(`${rec.status}: ${ctx.card.id} (PR step not run: push needs Chris's ok)`);
    return rec;
  } finally {
    fs.rmSync(lock, { force: true });
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  try {
    const o = parseArgs(process.argv.slice(2));
    if (!o.cardId) throw new Refusal('BAD_ARGS', 'usage: trm-dispatch.mjs <card-id> [--cli codex|claude|agy|copilot|grok] [--model X] [--effort low|medium|high] [--timeout-min N] [--dry-run]');
    await dispatch(o);
  } catch (e) {
    console.error(`REFUSED ${e.message}`);
    process.exit(e instanceof Refusal ? 3 : 1);
  }
}
