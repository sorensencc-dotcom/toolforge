import type { LocalProviderLike } from '../../src/providers/index.js';
import {
  DEFAULT_TIMEOUT_MS,
  errorCodeSuffix,
  isRecord,
  postJson,
  resolveKey,
  type ReviewerHttpDeps,
} from './provider-http.ts';

export type AnthropicProviderDeps = ReviewerHttpDeps;

const MESSAGES_URL = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2023-06-01';
const MAX_TOKENS = 8192;
const KEY_NAMES = ['ANTHROPIC_API_KEY', 'TOOLFORGE_ANTHROPIC_API_KEY'] as const;

export function createAnthropicProvider({
  fetch: send = globalThis.fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  ...keySources
}: AnthropicProviderDeps = {}): LocalProviderLike {
  const apiKey = resolveKey(KEY_NAMES, keySources);
  if (apiKey === undefined) throw new Error('Missing ANTHROPIC_API_KEY for secondary reviewer in dispatch matrix');

  return {
    async generate(model, prompt) {
      const { response, body } = await postJson(
        send,
        MESSAGES_URL,
        { 'x-api-key': apiKey, 'anthropic-version': API_VERSION },
        { model, max_tokens: MAX_TOKENS, messages: [{ role: 'user', content: prompt }] },
        { timeoutMs, label: `Anthropic message for ${model}` },
      );
      if (!response.ok) {
        throw new Error(`Anthropic message for ${model} failed with HTTP ${response.status}${errorCodeSuffix(body)}`);
      }
      const text = replyText(body);
      if (text === undefined) {
        throw new Error(`Anthropic message for ${model} returned a malformed body without a text content block`);
      }
      return text;
    },
  };
}

function replyText(body: unknown): string | undefined {
  const blocks = isRecord(body) && Array.isArray(body.content) ? body.content : [];
  const texts = blocks.filter(isRecord).filter((block) => block.type === 'text').map((block) => block.text);
  return texts.length > 0 && texts.every((text): text is string => typeof text === 'string') ? texts.join('') : undefined;
}
