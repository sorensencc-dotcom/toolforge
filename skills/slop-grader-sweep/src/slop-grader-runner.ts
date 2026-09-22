import { spawn } from 'node:child_process';

export interface SlopFinding {
  file: string;
  line: number;
  rule: string;
  severity: string;
  message: string;
}

export type SlopGraderResult =
  | { ok: true; findings: SlopFinding[] }
  | { ok: false; reason: string };

const RULESETS = 'no-ai-slop,tech-docs';

export function runSlopGrader(
  files: string[],
  apiKey: string,
  timeoutMs = 30000
): Promise<SlopGraderResult> {
  if (files.length === 0) {
    return Promise.resolve({ ok: true, findings: [] });
  }

  return new Promise((resolve) => {
    const child = spawn(
      'slop-grader',
      ['check', '--ruleset', RULESETS, '--format', 'json', ...files],
      { env: { ...process.env, OPENROUTER_API_KEY: apiKey } }
    );

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

      try {
        const findings = JSON.parse(stdout) as SlopFinding[];
        resolve({ ok: true, findings });
      } catch (err) {
        resolve({ ok: false, reason: `invalid JSON output: ${(err as Error).message}` });
      }
    });
  });
}
