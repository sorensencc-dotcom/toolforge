import { existsSync, readFileSync } from 'node:fs';
import { parse as parseDotEnv } from 'dotenv';
import type { LocalProviderLike } from '../../src/providers/index.js';

type EnvValues = Readonly<Record<string, string | undefined>>;

export interface OpenAIProviderDeps {
  readonly env?: EnvValues;
  /** Returns the repo-root `.env` text, or undefined when the file does not exist. */
  readonly readDotEnv?: () => string | undefined;
  readonly fetch?: (url: string, init: RequestInit) => Promise<Response>;
}

const CHAT_COMPLETIONS_URL = 'https://api.openai.com/v1/chat/completions';
const KEY_NAMES = ['OPENAI_API_KEY', 'TOOLFORGE_OPENAI_API_KEY'] as const;
const REPO_DOTENV = new URL('../../.env', import.meta.url);
const ERROR_CODE = /^[a-z_]+$/;

export function createOpenAIProvider({
  env = process.env,
  readDotEnv = readRepoDotEnv,
  fetch: send = globalThis.fetch,
}: OpenAIProviderDeps = {}): LocalProviderLike {
  const apiKey = findKey(env) ?? findKey(parseDotEnv(readDotEnv() ?? ''));
  if (apiKey === undefined) throw new Error('Missing OPENAI_API_KEY for secondary reviewer in dispatch matrix');

  return {
    async generate(model, prompt) {
      const response = await send(CHAT_COMPLETIONS_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }] }),
      });
      const body = parseJson(await response.text());
      if (!response.ok) {
        throw new Error(`OpenAI chat completion for ${model} failed with HTTP ${response.status}${errorCodeSuffix(body)}`);
      }
      const content = messageContent(body);
      if (content === undefined) {
        throw new Error(`OpenAI chat completion for ${model} returned a malformed body without choices[0].message.content`);
      }
      return content;
    },
  };
}

function findKey(values: EnvValues): string | undefined {
  return KEY_NAMES.map((name) => values[name]?.trim()).find(Boolean);
}

function readRepoDotEnv(): string | undefined {
  return existsSync(REPO_DOTENV) ? readFileSync(REPO_DOTENV, 'utf8') : undefined;
}

// The SyntaxError message quotes the start of the body, so it is never rethrown.
function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function messageContent(body: unknown): string | undefined {
  const choice = isRecord(body) && Array.isArray(body.choices) ? body.choices[0] : undefined;
  const content = isRecord(choice) && isRecord(choice.message) ? choice.message.content : undefined;
  return typeof content === 'string' ? content : undefined;
}

// OpenAI error messages echo part of the key, so only a snake_case code or type reaches the thrown message.
function errorCodeSuffix(body: unknown): string {
  const error: Record<string, unknown> = isRecord(body) && isRecord(body.error) ? body.error : {};
  const code = [error.code, error.type].find((value): value is string => typeof value === 'string' && ERROR_CODE.test(value));
  return code === undefined ? '' : ` (${code})`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
