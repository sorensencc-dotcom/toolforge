// Durable session records, question/answer boundary validation, and the event outbox for trm-dispatch.
// Session control state lives under the dispatcher status dir, never in the worker-writable worktree.
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export class Refusal extends Error {
  constructor(code, message) { super(`${code}: ${message}`); this.code = code; }
}

export const DEFAULT_MACHINE = 'WIN-DTA4V21LKVR';
export const WEBHOOK_ENV = 'TRM_DISPATCH_EVENT_WEBHOOK_URL';
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const LIMITS = { fileBytes: 4096, question: 1000, choices: 6, choice: 80, answerBytes: 8192 };
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

export const questionPath = (worktree) => path.join(worktree, '.trm-dispatch', 'question.json');

/** Child CLIs must never see the webhook URL. */
export function childEnv(env = process.env) {
  return Object.fromEntries(Object.entries(env).filter(([k]) => !k.startsWith('TRM_DISPATCH_EVENT_')));
}

function lstatOrNull(p, fsImpl) {
  try { return fsImpl.lstatSync(p); } catch (e) { if (e.code === 'ENOENT') return null; throw e; }
}

function plainText(v, max, what) {
  if (typeof v !== 'string') throw new Refusal('BAD_QUESTION', `${what} must be a string`);
  const t = v.trim();
  if (!t || t.length > max) throw new Refusal('BAD_QUESTION', `${what} must be 1-${max} chars`);
  if (CONTROL.test(t)) throw new Refusal('BAD_QUESTION', `${what} has control characters`);
  return t;
}

/** Returns null when absent, {question, choices} when valid, throws BAD_QUESTION otherwise. Text is data only. */
export function readQuestionArtifact(worktree, fsImpl = fs) {
  const p = questionPath(worktree);
  const st = lstatOrNull(p, fsImpl);
  if (!st) return null;
  if (st.isSymbolicLink() || !st.isFile()) throw new Refusal('BAD_QUESTION', 'artifact is not a regular file');
  if (st.size > LIMITS.fileBytes) throw new Refusal('BAD_QUESTION', `artifact over ${LIMITS.fileBytes} bytes`);
  const root = fsImpl.realpathSync(worktree);
  const dir = fsImpl.realpathSync(path.dirname(p));
  if (dir !== path.join(root, '.trm-dispatch')) throw new Refusal('BAD_QUESTION', 'artifact path escapes the worktree');
  let j;
  try { j = JSON.parse(fsImpl.readFileSync(p, 'utf8')); } catch { throw new Refusal('BAD_QUESTION', 'artifact is not valid JSON'); }
  if (!j || typeof j !== 'object' || Array.isArray(j)) throw new Refusal('BAD_QUESTION', 'artifact must be an object');
  const extra = Object.keys(j).filter((k) => !['version', 'question', 'choices'].includes(k));
  if (extra.length) throw new Refusal('BAD_QUESTION', `unexpected keys: ${extra.join(', ')}`);
  if (j.version !== 1) throw new Refusal('BAD_QUESTION', 'version must be 1');
  const question = plainText(j.question, LIMITS.question, 'question');
  let choices = [];
  if (j.choices !== undefined) {
    if (!Array.isArray(j.choices) || j.choices.length > LIMITS.choices) throw new Refusal('BAD_QUESTION', `choices must be an array of at most ${LIMITS.choices}`);
    choices = j.choices.map((c) => plainText(c, LIMITS.choice, 'choice'));
  }
  return { question, choices };
}

/** Remove the artifact itself (a symlink is unlinked, never followed). Safe when absent. */
export function clearQuestionArtifact(worktree, fsImpl = fs) {
  try { fsImpl.rmSync(questionPath(worktree), { force: true }); } catch { /* directory or locked: the validator rejects it later */ }
}

/** Parent-created answer file: absolute, regular, bounded, text. */
export function readAnswerFile(p, fsImpl = fs) {
  if (!p || !path.isAbsolute(p)) throw new Refusal('BAD_ANSWER', 'answer file must be an absolute path');
  const st = lstatOrNull(p, fsImpl);
  if (!st || st.isSymbolicLink() || !st.isFile()) throw new Refusal('BAD_ANSWER', 'answer file is missing or not a regular file');
  if (st.size === 0 || st.size > LIMITS.answerBytes) throw new Refusal('BAD_ANSWER', `answer file must be 1-${LIMITS.answerBytes} bytes`);
  const text = fsImpl.readFileSync(p, 'utf8');
  if (text.includes('\u0000')) throw new Refusal('BAD_ANSWER', 'answer file has NUL bytes');
  return text;
}

// ---- session store ----
const sessionsDir = (dir) => path.join(dir, 'trm_sessions');
// Lowercased so case-insensitive filesystems cannot alias two exact-case names onto one file.
export const sessionFile = (dir, name) => path.join(sessionsDir(dir), `${String(name).toLowerCase()}.json`);
const claimFile = (dir, name, requestId) => path.join(sessionsDir(dir), `${String(name).toLowerCase()}.claim-${requestId}`);

export function loadSession(dir, name) {
  try { return JSON.parse(fs.readFileSync(sessionFile(dir, name), 'utf8')); } catch (e) {
    if (e.code === 'ENOENT') return null;
    throw new Refusal('BAD_SESSION', `unreadable session record for ${name}`);
  }
}

/** Atomic replace: write a temp file, then rename over the record. */
export function saveSession(dir, rec) {
  const p = sessionFile(dir, rec.session_name);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const tmp = `${p}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify({ ...rec, updated_at: new Date().toISOString() }, null, 2));
  fs.renameSync(tmp, p);
}

export function newSessionRecord({ card, cli, branch, worktree, spec, cfg }) {
  return {
    version: 1, session_name: `trm-${card.id}`, card_id: card.id, run_id: cfg.uuid(), cli, native_session_id: null,
    worktree, branch, state: 'RUNNING', attempt: 1, pending_request: null, last_receipt: null, event_outbox: [],
    machine: cfg.machine, consumed_requests: [], owner: { pid: process.pid, started_at: cfg.now().toISOString() }, spec
  };
}

/** Refuse when a record already owns this (case-folded) name for another card, or is still active. */
export function assertNoCollision(dir, card) {
  const rec = loadSession(dir, `trm-${card.id}`);
  if (!rec) return;
  if (rec.card_id !== card.id) throw new Refusal('NAME_COLLISION', `session name for ${card.id} collides with ${rec.card_id} (case-insensitive worktree path)`);
  if (['RUNNING', 'WAITING_INPUT'].includes(rec.state)) throw new Refusal('SESSION_ACTIVE', `${rec.session_name} is ${rec.state}; resume or reconcile it`);
}

/** Exclusive claim: the one resumer that creates this file owns the request. The file is never reused. */
export function claimRequest(dir, name, requestId) {
  fs.mkdirSync(sessionsDir(dir), { recursive: true });
  let fd;
  try { fd = fs.openSync(claimFile(dir, name, requestId), 'wx'); } catch (e) {
    if (e.code === 'EEXIST') throw new Refusal('DUPLICATE_RESUME', `request ${requestId} already claimed; run --reconcile-session ${name}`);
    throw e;
  }
  fs.writeSync(fd, JSON.stringify({ pid: process.pid, at: new Date().toISOString() }));
  fs.closeSync(fd);
}

// ---- events ----
export function eventConfig(opts = {}) {
  return {
    dir: opts.statusDir || 'C:\\dev\\_status-feed',
    url: opts.eventWebhookUrl !== undefined ? opts.eventWebhookUrl : process.env[WEBHOOK_ENV],
    fetchImpl: opts.eventFetch || globalThis.fetch,
    timeoutMs: opts.eventTimeoutMs ?? 5000,
    retries: opts.eventRetries ?? 2,
    sleep: opts.sleep || ((ms) => new Promise((r) => setTimeout(r, ms))),
    machine: opts.machine || DEFAULT_MACHINE,
    now: opts.now || (() => new Date()),
    uuid: opts.uuid || randomUUID,
    requestTtlMs: opts.requestTtlMs ?? 24 * 3600 * 1000,
    isAlive: opts.isAlive || isPidAlive,
    log: opts.log || console.log
  };
}

export function isPidAlive(pid) {
  try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; }
}

export function testsStatus(status, gaps = []) {
  if (['TIMEOUT', 'ERROR'].includes(status)) return 'NOT_RUN';
  if (gaps.some((g) => String(g).startsWith('tests failed'))) return 'FAIL';
  return 'PASS';
}

const SUMMARY = { PR_OPEN: 'Draft PR opened', NEEDS_HUMAN: 'Needs human review', TIMEOUT: 'Run timed out', ERROR: 'Dispatch error' };

/** Public payload only: no paths, commands, logs, native session id, or webhook URL. */
export function buildEvent(rec, cfg, { kind, status, request, result }) {
  const ev = {
    version: 1, event_id: cfg.uuid(), kind, occurred_at: cfg.now().toISOString(), machine: cfg.machine,
    session_name: rec.session_name, run_id: rec.run_id, attempt: rec.attempt, card_id: rec.card_id, cli: rec.cli, status
  };
  if (request) ev.request = { id: request.id, question: request.question, choices: request.choices };
  if (result) ev.result = { summary: SUMMARY[status] || 'Finished', pr_url: result.pr_url || null, tests: result.tests };
  return ev;
}

/** One POST sequence for one event. Same event_id and body on every attempt. Never throws; errors are codes, not messages. */
export async function postEvent(event, { url, fetchImpl, timeoutMs, retries, sleep }) {
  if (!url) return { ok: false, attempts: 0, error: 'no_webhook_url' };
  let u;
  try { u = new URL(url); } catch { return { ok: false, attempts: 0, error: 'bad_webhook_url' }; }
  if (u.protocol !== 'https:') return { ok: false, attempts: 0, error: 'bad_webhook_url' };
  const body = JSON.stringify(event);
  let attempts = 0, error = 'network';
  for (let i = 0; i <= retries; i++) {
    if (i) await sleep(250 * 2 ** (i - 1));
    attempts++;
    try {
      const res = await fetchImpl(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body, redirect: 'manual', signal: AbortSignal.timeout(timeoutMs) });
      if (res.type === 'opaqueredirect' || (res.status >= 300 && res.status < 400)) return { ok: false, attempts, error: 'redirect_refused' };
      if (res.ok) return { ok: true, attempts, error: null };
      error = `http_${res.status}`;
      if (res.status < 500 && res.status !== 408 && res.status !== 429) return { ok: false, attempts, error };
    } catch (e) {
      error = e?.name === 'TimeoutError' || e?.name === 'AbortError' ? 'timeout' : 'network';
    }
  }
  return { ok: false, attempts, error };
}

/** Send every undelivered outbox entry, oldest first. Delivery failure never changes job state. */
export async function deliverOutbox(rec, cfg) {
  for (const entry of rec.event_outbox) {
    if (entry.state === 'delivered') continue;
    const r = await postEvent(entry.event, cfg);
    entry.attempts += r.attempts;
    entry.last_error = r.error;
    if (r.ok) { entry.state = 'delivered'; entry.delivered_at = cfg.now().toISOString(); } else if (r.attempts) entry.state = 'failed';
    saveSession(cfg.dir, rec);
    if (!r.ok) cfg.log(`event ${entry.event.kind} ${entry.event.event_id} not delivered (${r.error}); kept in outbox`);
  }
}

/** Write the event to the durable outbox first, then try to POST it. */
export async function emitEvent(rec, cfg, spec) {
  const event = buildEvent(rec, cfg, spec);
  rec.event_outbox.push({ event, state: 'pending', attempts: 0, last_error: null });
  saveSession(cfg.dir, rec);
  await deliverOutbox(rec, cfg);
  return event;
}

/**
 * Reconcile a crashed resume. Never respawns the CLI.
 * - RUNNING with a dead owner: the spawn is uncertain, so close the run as FAILED (job.finished ERROR).
 * - WAITING_INPUT with a claim but no RUNNING write: the spawn certainly never started, so release the claim.
 * Then re-send undelivered events with their original event ids.
 */
export async function reconcileSession(name, cfg) {
  const rec = loadSession(cfg.dir, name);
  if (!rec || rec.session_name !== name) throw new Refusal('UNKNOWN_SESSION', `no session ${name}`);
  let action = 'none';
  if (rec.state === 'RUNNING') {
    if (rec.owner?.pid && cfg.isAlive(rec.owner.pid)) throw new Refusal('RUN_ACTIVE', `${name} owner pid ${rec.owner.pid} is alive`);
    rec.state = 'FAILED'; rec.owner = null;
    rec.last_receipt = { status: 'ERROR', reason: 'run interrupted before completion' };
    fs.rmSync(path.join(rec.worktree, '.trm-dispatch', 'lock'), { force: true });
    await emitEvent(rec, cfg, { kind: 'job.finished', status: 'ERROR', result: { pr_url: null, tests: 'NOT_RUN' } });
    action = 'run_failed';
  } else if (rec.state === 'WAITING_INPUT' && rec.pending_request) {
    const c = claimFile(cfg.dir, name, rec.pending_request.id);
    if (fs.existsSync(c)) { fs.rmSync(c); action = 'claim_released'; }
  }
  await deliverOutbox(rec, cfg);
  return { action, state: rec.state, undelivered: rec.event_outbox.filter((e) => e.state !== 'delivered').length };
}
