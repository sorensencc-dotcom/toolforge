import { existsSync, readFileSync } from 'node:fs';
import { parse as parseDotEnv } from 'dotenv';

export type EnvValues = Readonly<Record<string, string | undefined>>;

export const DEFAULT_TIMEOUT_MS = 120_000;

export interface ReviewerHttpDeps {
  readonly env?: EnvValues;
  /** Returns the repo-root `.env` text, or undefined when the file does not exist. */
  readonly readDotEnv?: () => string | undefined;
  readonly fetch?: (url: string, init: RequestInit) => Promise<Response>;
  /** Aborts the request after this many milliseconds. Defaults to 120000. */
  readonly timeoutMs?: number;
}

const REPO_DOTENV = new URL('../../.env', import.meta.url);
const ERROR_CODE = /^[a-z_]+$/;

export function readRepoDotEnv(): string | undefined {
  return existsSync(REPO_DOTENV) ? readFileSync(REPO_DOTENV, 'utf8') : undefined;
}

export function resolveKey(
  names: readonly string[],
  { env = process.env, readDotEnv = readRepoDotEnv }: Pick<ReviewerHttpDeps, 'env' | 'readDotEnv'>,
): string | undefined {
  return findKey(env, names) ?? findKey(parseDotEnv(readDotEnv() ?? ''), names);
}

function findKey(values: EnvValues, names: readonly string[]): string | undefined {
  return names.map((name) => values[name]?.trim()).find(Boolean);
}

/** Posts with an abort signal, so a stalled request fails with `${label} timed out` instead of waiting out undici's 300 s default. */
export async function postJson(
  send: (url: string, init: RequestInit) => Promise<Response>,
  url: string,
  headers: Record<string, string>,
  body: unknown,
  { timeoutMs, label }: { readonly timeoutMs: number; readonly label: string },
): Promise<{ response: Response; body: unknown }> {
  const signal = AbortSignal.timeout(timeoutMs);
  try {
    const response = await send(url, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });
    return { response, body: parseJson(await response.text()) };
  } catch (error) {
    if (signal.aborted) throw new Error(`${label} timed out after ${timeoutMs} ms`);
    throw error;
  }
}

// The SyntaxError message quotes the start of the body, so it is never rethrown.
function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

// Provider error messages can echo part of the key, so only a snake_case code or type reaches the thrown message.
export function errorCodeSuffix(body: unknown): string {
  const error: Record<string, unknown> = isReviewerJsonObject(body) && isReviewerJsonObject(body.error) ? body.error : {};
  const code = [error.code, error.type].find((value): value is string => typeof value === 'string' && ERROR_CODE.test(value));
  return code === undefined ? '' : ` (${code})`;
}

export function isReviewerJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
