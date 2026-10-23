import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { inspect } from 'node:util';
import { createOpenAIProvider, type OpenAIProviderDeps } from './openai-provider.ts';

const MISSING_KEY = 'Missing OPENAI_API_KEY for secondary reviewer in dispatch matrix';
const TEST_KEY = 'test-openai-key-0123';
const MODEL = 'gpt-6.1-sol';

interface SentRequest {
  readonly url: string;
  readonly init: RequestInit;
}

function completion(content: unknown): Response {
  return Response.json({
    id: 'chatcmpl-1',
    object: 'chat.completion',
    choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }],
  });
}

function recordingFetch(respond: () => Response = () => completion('{"findings": [], "noise": []}')) {
  const sent: SentRequest[] = [];
  const fetch = async (url: string, init: RequestInit): Promise<Response> => {
    sent.push({ url, init });
    return respond();
  };
  return { fetch, sent };
}

function provider(overrides: OpenAIProviderDeps = {}) {
  return createOpenAIProvider({
    env: { OPENAI_API_KEY: TEST_KEY },
    readDotEnv: () => undefined,
    fetch: recordingFetch().fetch,
    ...overrides,
  });
}

function sentKey(request: SentRequest): string | null {
  return new Headers(request.init.headers).get('authorization');
}

function assertKeyHidden(value: unknown): void {
  assert.equal(inspect(value, { showHidden: true, depth: Infinity }).includes(TEST_KEY), false, 'output leaks the API key');
}

describe('createOpenAIProvider', () => {
  it('posts the prompt to OpenAI chat completions and returns the reply text', async () => {
    const { fetch, sent } = recordingFetch(() => completion('reply text'));
    assert.equal(await provider({ fetch }).generate(MODEL, 'Review this diff'), 'reply text');
    assert.equal(sent.length, 1);
    assert.equal(sent[0].url, 'https://api.openai.com/v1/chat/completions');
    assert.equal(sent[0].init.method, 'POST');
    assert.equal(sentKey(sent[0]), `Bearer ${TEST_KEY}`);
    assert.equal(new Headers(sent[0].init.headers).get('content-type'), 'application/json');
    assert.deepEqual(JSON.parse(String(sent[0].init.body)), {
      model: MODEL,
      messages: [{ role: 'user', content: 'Review this diff' }],
    });
  });

  describe('credentials', () => {
    const keyCases: [string, Record<string, string | undefined>, string | undefined, string][] = [
      ['OPENAI_API_KEY from the environment', { OPENAI_API_KEY: 'env-openai-key' }, undefined, 'env-openai-key'],
      [
        'TOOLFORGE_OPENAI_API_KEY when OPENAI_API_KEY is unset',
        { TOOLFORGE_OPENAI_API_KEY: 'env-toolforge-key' },
        undefined,
        'env-toolforge-key',
      ],
      [
        'OPENAI_API_KEY over TOOLFORGE_OPENAI_API_KEY',
        { OPENAI_API_KEY: 'env-openai-key', TOOLFORGE_OPENAI_API_KEY: 'env-toolforge-key' },
        undefined,
        'env-openai-key',
      ],
      [
        'TOOLFORGE_OPENAI_API_KEY when OPENAI_API_KEY is blank',
        { OPENAI_API_KEY: ' ', TOOLFORGE_OPENAI_API_KEY: 'env-toolforge-key' },
        undefined,
        'env-toolforge-key',
      ],
      ['OPENAI_API_KEY from the repo .env', {}, 'OPENAI_API_KEY=file-openai-key\n', 'file-openai-key'],
      [
        'TOOLFORGE_OPENAI_API_KEY from the repo .env',
        {},
        '# reviewer keys\r\nexport TOOLFORGE_OPENAI_API_KEY="file-toolforge-key"\r\n',
        'file-toolforge-key',
      ],
      ['a repo .env saved with a byte order mark', {}, '﻿OPENAI_API_KEY=file-openai-key\r\n', 'file-openai-key'],
      ['the environment over the repo .env', { OPENAI_API_KEY: 'env-openai-key' }, 'OPENAI_API_KEY=file-openai-key', 'env-openai-key'],
      [
        'either environment key over either .env key',
        { TOOLFORGE_OPENAI_API_KEY: 'env-toolforge-key' },
        'OPENAI_API_KEY=file-openai-key',
        'env-toolforge-key',
      ],
      ['the repo .env when the environment key is empty', { OPENAI_API_KEY: '' }, 'OPENAI_API_KEY=file-openai-key', 'file-openai-key'],
    ];
    for (const [name, env, dotEnv, expected] of keyCases) {
      it(`authenticates with ${name}`, async () => {
        const { fetch, sent } = recordingFetch();
        await createOpenAIProvider({ env, readDotEnv: () => dotEnv, fetch }).generate(MODEL, 'Review this diff');
        assert.equal(sentKey(sent[0]), `Bearer ${expected}`);
      });
    }

    const missingCases: [string, Record<string, string | undefined>, string | undefined][] = [
      ['no key and no repo .env', {}, undefined],
      ['no key and an empty repo .env', {}, ''],
      [
        'blank keys in both the environment and the repo .env',
        { OPENAI_API_KEY: '', TOOLFORGE_OPENAI_API_KEY: '  ' },
        'OTHER_SETTING=1\nOPENAI_API_KEY=\n',
      ],
    ];
    for (const [name, env, dotEnv] of missingCases) {
      it(`fails fast with the dispatch-matrix error given ${name}`, () => {
        assert.throws(() => createOpenAIProvider({ env, readDotEnv: () => dotEnv, fetch: recordingFetch().fetch }), {
          message: MISSING_KEY,
        });
      });
    }

    it('keeps the key out of the provider object', () => {
      const instance = provider();
      assertKeyHidden(instance);
      assert.equal(JSON.stringify(instance).includes(TEST_KEY), false);
    });
  });

  describe('failed requests', () => {
    const failures: [string, () => Response, RegExp][] = [
      [
        'a 401 whose body echoes the key',
        () =>
          Response.json(
            {
              error: {
                message: `Incorrect API key provided: ${TEST_KEY}.`,
                type: 'invalid_request_error',
                code: 'invalid_api_key',
              },
            },
            { status: 401 },
          ),
        /HTTP 401 \(invalid_api_key\)/,
      ],
      [
        'a 404 for a model the account cannot use',
        () =>
          Response.json(
            { error: { message: `The model ${MODEL} does not exist`, type: 'invalid_request_error', code: 'model_not_found' } },
            { status: 404 },
          ),
        /HTTP 404 \(model_not_found\)/,
      ],
      [
        'a 429 with a null code',
        () =>
          Response.json(
            { error: { message: 'You exceeded your current quota', type: 'insufficient_quota', code: null } },
            { status: 429 },
          ),
        /HTTP 429 \(insufficient_quota\)/,
      ],
      ['a 401 whose error code is the key', () => Response.json({ error: { code: TEST_KEY } }, { status: 401 }), /HTTP 401/],
      ['a 502 page that echoes the key', () => new Response(`<html>Bad gateway for ${TEST_KEY}</html>`, { status: 502 }), /HTTP 502/],
    ];
    for (const [name, respond, expected] of failures) {
      it(`rejects ${name} with the status and without the key`, async () => {
        await assert.rejects(provider({ fetch: recordingFetch(respond).fetch }).generate(MODEL, 'Review this diff'), (error) => {
          assert.ok(error instanceof Error);
          assert.match(error.message, expected);
          assertKeyHidden(error);
          return true;
        });
      });
    }

    const malformed: [string, () => Response][] = [
      ['a body that is not JSON and echoes the key', () => new Response(`upstream says ${TEST_KEY}`)],
      ['an empty body', () => new Response('')],
      ['a JSON null body', () => Response.json(null)],
      ['a body without choices that echoes the key', () => Response.json({ object: 'chat.completion', echo: TEST_KEY })],
      ['an empty choices list', () => Response.json({ choices: [] })],
      ['a choice without a message', () => Response.json({ choices: [{ index: 0, finish_reason: 'stop' }] })],
      ['a refusal with null content', () => completion(null)],
      ['non-string content', () => completion([{ type: 'text', text: 'reply' }])],
    ];
    for (const [name, respond] of malformed) {
      it(`rejects ${name} as malformed and without the key`, async () => {
        await assert.rejects(provider({ fetch: recordingFetch(respond).fetch }).generate(MODEL, 'Review this diff'), (error) => {
          assert.ok(error instanceof Error);
          assert.match(error.message, /malformed/i);
          assertKeyHidden(error);
          return true;
        });
      });
    }
  });
  describe('timeout', () => {
    const hang = (_url: string, init: RequestInit): Promise<Response> =>
      new Promise((_resolve, reject) => init.signal?.addEventListener('abort', () => reject(init.signal?.reason)));

    it('passes an abort signal with the request', async () => {
      const { fetch, sent } = recordingFetch();
      await provider({ fetch }).generate(MODEL, 'Review this diff');
      assert.ok(sent[0].init.signal instanceof AbortSignal);
    });

    it('rejects with a timeout message when the request exceeds timeoutMs', async () => {
      await assert.rejects(provider({ fetch: hang, timeoutMs: 10 }).generate(MODEL, 'Review this diff'), {
        message: `OpenAI chat completion for ${MODEL} timed out after 10 ms`,
      });
    });
  });
});
