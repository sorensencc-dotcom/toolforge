import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { inspect } from 'node:util';
import { createAnthropicProvider, type AnthropicProviderDeps } from './anthropic-provider.ts';

const MISSING_KEY = 'Missing ANTHROPIC_API_KEY for secondary reviewer in dispatch matrix';
const TEST_KEY = 'test-anthropic-key-0123';
const MODEL = 'claude-opus-5-5';

interface SentRequest {
  readonly url: string;
  readonly init: RequestInit;
}

function message(text: unknown): Response {
  return Response.json({ id: 'msg_1', type: 'message', role: 'assistant', content: [{ type: 'text', text }], stop_reason: 'end_turn' });
}

function recordingFetch(respond: () => Response = () => message('{"findings": [], "noise": []}')) {
  const sent: SentRequest[] = [];
  const fetch = async (url: string, init: RequestInit): Promise<Response> => {
    sent.push({ url, init });
    return respond();
  };
  return { fetch, sent };
}

function provider(overrides: AnthropicProviderDeps = {}) {
  return createAnthropicProvider({
    env: { ANTHROPIC_API_KEY: TEST_KEY },
    readDotEnv: () => undefined,
    fetch: recordingFetch().fetch,
    ...overrides,
  });
}

function assertKeyHidden(value: unknown): void {
  assert.equal(inspect(value, { showHidden: true, depth: Infinity }).includes(TEST_KEY), false, 'output leaks the API key');
}

describe('createAnthropicProvider', () => {
  it('posts the prompt to the Messages API and returns the reply text', async () => {
    const { fetch, sent } = recordingFetch(() => message('reply text'));
    assert.equal(await provider({ fetch }).generate(MODEL, 'Review this diff'), 'reply text');
    assert.equal(sent.length, 1);
    assert.equal(sent[0].url, 'https://api.anthropic.com/v1/messages');
    assert.equal(sent[0].init.method, 'POST');
    const headers = new Headers(sent[0].init.headers);
    assert.equal(headers.get('x-api-key'), TEST_KEY);
    assert.equal(headers.get('anthropic-version'), '2023-06-01');
    assert.equal(headers.get('content-type'), 'application/json');
    assert.deepEqual(JSON.parse(String(sent[0].init.body)), {
      model: MODEL,
      max_tokens: 8192,
      messages: [{ role: 'user', content: 'Review this diff' }],
    });
  });

  it('joins multiple text blocks and skips non-text blocks', async () => {
    const respond = () =>
      Response.json({ content: [{ type: 'thinking', thinking: 'x' }, { type: 'text', text: 'a' }, { type: 'text', text: 'b' }] });
    assert.equal(await provider({ fetch: recordingFetch(respond).fetch }).generate(MODEL, 'p'), 'ab');
  });

  const keyCases: [string, Record<string, string | undefined>, string | undefined, string][] = [
    ['ANTHROPIC_API_KEY from the environment', { ANTHROPIC_API_KEY: 'env-key' }, undefined, 'env-key'],
    ['TOOLFORGE_ANTHROPIC_API_KEY when ANTHROPIC_API_KEY is blank', { ANTHROPIC_API_KEY: ' ', TOOLFORGE_ANTHROPIC_API_KEY: 'tf-key' }, undefined, 'tf-key'],
    ['ANTHROPIC_API_KEY from the repo .env', {}, 'ANTHROPIC_API_KEY=file-key\n', 'file-key'],
    ['the environment over the repo .env', { ANTHROPIC_API_KEY: 'env-key' }, 'ANTHROPIC_API_KEY=file-key', 'env-key'],
  ];
  for (const [name, env, dotEnv, expected] of keyCases) {
    it(`authenticates with ${name}`, async () => {
      const { fetch, sent } = recordingFetch();
      await createAnthropicProvider({ env, readDotEnv: () => dotEnv, fetch }).generate(MODEL, 'p');
      assert.equal(new Headers(sent[0].init.headers).get('x-api-key'), expected);
    });
  }

  it('fails fast when no key is set', () => {
    assert.throws(() => createAnthropicProvider({ env: {}, readDotEnv: () => undefined, fetch: recordingFetch().fetch }), {
      message: MISSING_KEY,
    });
  });

  it('keeps the key out of the provider object', () => {
    assertKeyHidden(provider());
  });

  it('rejects an HTTP error with the status and error type but without the key', async () => {
    const respond = () =>
      Response.json({ type: 'error', error: { type: 'authentication_error', message: `invalid x-api-key ${TEST_KEY}` } }, { status: 401 });
    await assert.rejects(provider({ fetch: recordingFetch(respond).fetch }).generate(MODEL, 'p'), (error) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /HTTP 401 \(authentication_error\)/);
      assertKeyHidden(error);
      return true;
    });
  });

  const malformed: [string, () => Response][] = [
    ['a body that is not JSON and echoes the key', () => new Response(`upstream says ${TEST_KEY}`)],
    ['no content blocks', () => Response.json({ content: [] })],
    ['only non-text blocks', () => Response.json({ content: [{ type: 'tool_use' }] })],
    ['non-string text', () => message(null)],
  ];
  for (const [name, respond] of malformed) {
    it(`rejects ${name} as malformed and without the key`, async () => {
      await assert.rejects(provider({ fetch: recordingFetch(respond).fetch }).generate(MODEL, 'p'), (error) => {
        assert.ok(error instanceof Error);
        assert.match(error.message, /malformed/i);
        assertKeyHidden(error);
        return true;
      });
    });
  }

  describe('timeout', () => {
    const hang = (_url: string, init: RequestInit): Promise<Response> =>
      new Promise((_resolve, reject) => init.signal?.addEventListener('abort', () => reject(init.signal?.reason)));

    it('passes an abort signal with the default timeout', async () => {
      const { fetch, sent } = recordingFetch();
      await provider({ fetch }).generate(MODEL, 'p');
      assert.ok(sent[0].init.signal instanceof AbortSignal);
    });

    it('rejects with a timeout message when the request exceeds timeoutMs', async () => {
      await assert.rejects(provider({ fetch: hang, timeoutMs: 10 }).generate(MODEL, 'p'), {
        message: `Anthropic message for ${MODEL} timed out after 10 ms`,
      });
    });
  });
});
