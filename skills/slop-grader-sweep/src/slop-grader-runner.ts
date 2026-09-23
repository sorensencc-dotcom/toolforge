import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

export interface SlopFinding {
  file: string;
  line: number;
  rule: string;
  severity: string;
  message: string;
}

export type SlopGraderResult =
  | { ok: true; findings: SlopFinding[]; errors?: string[] }
  | { ok: false; reason: string };

/**
 * Shape of `slop-grader --json` output, verified against
 * @lukstei/slop-grader@0.2.5 (README "JSON report (--json)").
 * One object per invocation — the CLI grades a single file per call.
 */
export interface SlopGraderLineViolation {
  lineNum: number;
  text?: string;
  rules: string[];
}

export interface SlopGraderDocumentViolation {
  score?: number;
  max?: number;
  confidence?: number;
  label?: string;
}

export interface SlopGraderJson {
  file: string;
  rules: string[];
  violations: {
    lines: SlopGraderLineViolation[];
    document: Record<string, SlopGraderDocumentViolation>;
  };
  stats?: Record<string, number>;
}

export const RULESETS = ['no-ai-slop', 'tech-docs'];

/** Pre-commit budget. Scoped to the changed-files path only (plan Global Constraints). */
export const DEFAULT_TIMEOUT_MS = 30_000;

/** Scheduled full-repo sweep budget — per file, not for the whole run. */
export const SWEEP_TIMEOUT_MS = 20 * 60 * 1000;

const DEFAULT_CONCURRENCY = 4;
const LINE_SEVERITY = 'warning';
export const DOCUMENT_SEVERITY = 'document';
const MAX_MESSAGE_LENGTH = 200;

let cachedEntrypoint: string | undefined;

/**
 * Resolve the grader's own entrypoint module.
 *
 * `node_modules/.bin` is only on PATH inside `npm run` scripts, and on Windows
 * the shim is a `.cmd` that Node refuses to spawn without `shell: true`.
 * Spawning the resolved `.mjs` under `process.execPath` avoids both, and avoids
 * `shell: true` entirely — filenames come from `git diff` and must never reach a shell.
 */
export function resolveGraderEntrypoint(): string {
  if (cachedEntrypoint) return cachedEntrypoint;
  const requireFrom = createRequire(__filename);
  cachedEntrypoint = requireFrom.resolve('@lukstei/slop-grader/dist/slop-grader.mjs');
  return cachedEntrypoint;
}

/**
 * Build argv for one file. The real CLI is:
 *   slop-grader [-c|--check] -r <ruleset> [-r <ruleset> ...] [--json] [file]
 * `-r` is repeatable (never comma-joined), `--json` replaces `--format json`,
 * and exactly one positional file is accepted per invocation.
 */
export function buildGraderArgs(file: string, rulesets: string[] = RULESETS): string[] {
  const args: string[] = [];
  for (const ruleset of rulesets) {
    args.push('-r', ruleset);
  }
  args.push('--json', file);
  return args;
}

function truncate(text: string): string {
  const trimmed = text.trim();
  return trimmed.length > MAX_MESSAGE_LENGTH
    ? `${trimmed.slice(0, MAX_MESSAGE_LENGTH - 1)}…`
    : trimmed;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Parse and validate a `--json` payload, then map it onto `SlopFinding[]`.
 * A shape mismatch resolves to `ok: false` with a readable reason rather than
 * throwing or silently emitting undefined fields.
 */
export function parseSlopGraderJson(
  raw: string,
  file: string
): { ok: true; findings: SlopFinding[] } | { ok: false; reason: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    return { ok: false, reason: `invalid JSON output: ${(err as Error).message}` };
  }

  if (!isRecord(parsed)) {
    return { ok: false, reason: 'unexpected JSON shape: expected an object at the top level' };
  }

  const violations = parsed.violations;
  if (!isRecord(violations)) {
    return { ok: false, reason: 'unexpected JSON shape: missing "violations" object' };
  }

  const rawLines = violations.lines ?? [];
  if (!Array.isArray(rawLines)) {
    return { ok: false, reason: 'unexpected JSON shape: "violations.lines" is not an array' };
  }

  const findings: SlopFinding[] = [];

  for (const entry of rawLines) {
    if (!isRecord(entry) || typeof entry.lineNum !== 'number' || !Array.isArray(entry.rules)) {
      return {
        ok: false,
        reason: 'unexpected JSON shape: "violations.lines[]" entries need lineNum and rules',
      };
    }
    const text = typeof entry.text === 'string' ? truncate(entry.text) : '';
    for (const rule of entry.rules) {
      if (typeof rule !== 'string') {
        return { ok: false, reason: 'unexpected JSON shape: "violations.lines[].rules" must be strings' };
      }
      findings.push({
        file,
        line: entry.lineNum,
        rule,
        severity: LINE_SEVERITY,
        message: text,
      });
    }
  }

  const rawDocument = violations.document ?? {};
  if (!isRecord(rawDocument)) {
    return { ok: false, reason: 'unexpected JSON shape: "violations.document" is not an object' };
  }

  // Document-scope rules carry no line number. They are folded in as synthetic
  // findings on line 0, which the report formatter renders as "Document-level".
  for (const [rule, value] of Object.entries(rawDocument)) {
    if (!isRecord(value)) {
      return { ok: false, reason: `unexpected JSON shape: "violations.document.${rule}" is not an object` };
    }
    const label = typeof value.label === 'string' ? value.label : 'document rule violation';
    const score = typeof value.score === 'number' ? value.score : undefined;
    const max = typeof value.max === 'number' ? value.max : undefined;
    const scoreText = score !== undefined ? ` (score ${score}${max !== undefined ? `/${max}` : ''})` : '';
    findings.push({
      file,
      line: 0,
      rule,
      severity: DOCUMENT_SEVERITY,
      message: `${label}${scoreText}`,
    });
  }

  return { ok: true, findings };
}

/** Grade exactly one file. The upstream CLI accepts one positional file per call. */
export function runSlopGraderOnFile(
  file: string,
  apiKey: string,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<{ ok: true; findings: SlopFinding[] } | { ok: false; reason: string }> {
  return new Promise((resolve) => {
    let entrypoint: string;
    try {
      entrypoint = resolveGraderEntrypoint();
    } catch (err) {
      resolve({ ok: false, reason: `cannot resolve @lukstei/slop-grader: ${(err as Error).message}` });
      return;
    }

    const child = spawn(process.execPath, [entrypoint, ...buildGraderArgs(file)], {
      env: { ...process.env, OPENROUTER_API_KEY: apiKey },
    });

    let stdout = '';
    let stderr = '';
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill('SIGKILL');
      resolve({ ok: false, reason: `timed out after ${timeoutMs}ms` });
    }, timeoutMs);

    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    child.on('error', (err: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ ok: false, reason: err.message });
    });

    child.on('close', (code: number | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);

      if (code !== 0) {
        resolve({ ok: false, reason: stderr.trim() || `exited with code ${code}` });
        return;
      }

      resolve(parseSlopGraderJson(stdout, file));
    });
  });
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;

  const workerCount = Math.max(1, Math.min(limit, items.length));
  const workers = Array.from({ length: workerCount }, async () => {
    for (;;) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      results[index] = await fn(items[index]);
    }
  });

  await Promise.all(workers);
  return results;
}

/**
 * Grade every file, one subprocess per file, bounded concurrency.
 *
 * Partial failures do not discard the successful results: the run is `ok: false`
 * only when every file failed. Surviving per-file errors ride along in `errors`
 * so callers can mark a report DEGRADED without losing its findings.
 */
export async function runSlopGrader(
  files: string[],
  apiKey: string,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
  concurrency: number = DEFAULT_CONCURRENCY
): Promise<SlopGraderResult> {
  if (files.length === 0) {
    return { ok: true, findings: [] };
  }

  const outcomes = await mapWithConcurrency(files, concurrency, (file) =>
    runSlopGraderOnFile(file, apiKey, timeoutMs)
  );

  const findings: SlopFinding[] = [];
  const errors: string[] = [];

  outcomes.forEach((outcome, index) => {
    if (outcome.ok) {
      findings.push(...outcome.findings);
    } else {
      errors.push(`${files[index]}: ${outcome.reason}`);
    }
  });

  if (errors.length === files.length) {
    return { ok: false, reason: errors[0] };
  }

  return errors.length > 0 ? { ok: true, findings, errors } : { ok: true, findings };
}
