import type { LocalProviderLike } from '../../src/providers/index.js';
import {
  DEFAULT_TIMEOUT_MS,
  errorCodeSuffix,
  isRecord,
  postJson,
  resolveKey,
  type ReviewerHttpDeps,
} from './provider-http.ts';

export type OpenAIProviderDeps = ReviewerHttpDeps;

const CHAT_COMPLETIONS_URL = 'https://api.openai.com/v1/chat/completions';
const KEY_NAMES = ['OPENAI_API_KEY', 'TOOLFORGE_OPENAI_API_KEY'] as const;

export function createOpenAIProvider({
  fetch: send = globalThis.fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  ...keySources
}: OpenAIProviderDeps = {}): LocalProviderLike {
  const apiKey = resolveKey(KEY_NAMES, keySources);
  if (apiKey === undefined) throw new Error('Missing OPENAI_API_KEY for secondary reviewer in dispatch matrix');

  return {
    async generate(model, prompt) {
      const { response, body } = await postJson(
        send,
        CHAT_COMPLETIONS_URL,
        { Authorization: `Bearer ${apiKey}` },
        { model, messages: [{ role: 'user', content: prompt }] },
        { timeoutMs, label: `OpenAI chat completion for ${model}` },
      );
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

function messageContent(body: unknown): string | undefined {
  const choice = isRecord(body) && Array.isArray(body.choices) ? body.choices[0] : undefined;
  const content = isRecord(choice) && isRecord(choice.message) ? choice.message.content : undefined;
  return typeof content === 'string' ? content : undefined;
}
