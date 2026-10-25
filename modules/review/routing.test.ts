import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ReviewRoutingError,
  resolveReviewerProvider,
  selectReviewer,
  type ReviewPacket,
  type ReviewerMatrix,
  type ReviewerRoute,
} from './routing.ts';

const GPT_REVIEWER: ReviewerRoute = { provider: 'openai', model: 'gpt-6.1-sol' };
const CLAUDE_REVIEWER: ReviewerRoute = { provider: 'anthropic', model: 'claude-opus-5-5' };
const CLAUDE_TRAILER = 'Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>';
const GPT_TRAILER = 'Co-Authored-By: GPT-6.1 Sol <noreply@openai.com>';
const HUMAN_TRAILER = 'Co-authored-by: Chris Sorensen <chris@example.com>';
const MISSING_KEY = 'Missing OPENAI_API_KEY for secondary reviewer in dispatch matrix';

function commitMessage(...trailers: string[]): string {
  return ['feat(review): add reviewer routing', '', 'Send each diff to a reviewer from the other model family.', '', ...trailers].join(
    '\n',
  );
}

describe('selectReviewer', () => {
  describe('author_model field', () => {
    for (const [author, reviewer] of [
      ['claude-opus-5-5', GPT_REVIEWER],
      ['claude-sonnet-5', GPT_REVIEWER],
      ['gpt-6.1-sol', CLAUDE_REVIEWER],
      ['gpt-4o', CLAUDE_REVIEWER],
    ] as const) {
      it(`routes ${author} to ${reviewer.model}`, () => {
        assert.deepEqual(selectReviewer({ author_model: author }), reviewer);
      });
    }

    it('matches author prefixes case-insensitively', () => {
      assert.deepEqual(selectReviewer({ author_model: 'Claude-Opus-5-5' }), GPT_REVIEWER);
      assert.deepEqual(selectReviewer({ author_model: 'GPT-6.1-SOL' }), CLAUDE_REVIEWER);
      const matrix: ReviewerMatrix = [{ authorPrefix: 'GEMINI-', reviewer: GPT_REVIEWER }];
      assert.deepEqual(selectReviewer({ author_model: 'gemini-3-pro' }, matrix), GPT_REVIEWER);
    });
  });

  describe('Co-Authored-By trailer', () => {
    it('routes a Claude co-author to gpt-6.1-sol', () => {
      assert.deepEqual(selectReviewer({ commitMessage: commitMessage(CLAUDE_TRAILER) }), GPT_REVIEWER);
    });

    it('routes a GPT co-author to Claude', () => {
      assert.deepEqual(selectReviewer({ commitMessage: commitMessage(GPT_TRAILER) }), CLAUDE_REVIEWER);
    });

    it('reads the trailer key in any case and across CRLF line endings', () => {
      const lowerKey = commitMessage('co-authored-by: Claude Sonnet 5 <noreply@anthropic.com>');
      assert.deepEqual(selectReviewer({ commitMessage: lowerKey }), GPT_REVIEWER);
      const crlf = 'fix(review): handle CRLF\r\n\r\nCo-authored-by: GPT-6.1 Sol <noreply@openai.com>\r\n';
      assert.deepEqual(selectReviewer({ commitMessage: crlf }), CLAUDE_REVIEWER);
    });

    it('fails closed when trailers name different reviewer families, in either order', () => {
      for (const trailers of [[GPT_TRAILER, CLAUDE_TRAILER], [CLAUDE_TRAILER, GPT_TRAILER]]) {
        assert.throws(() => selectReviewer({ commitMessage: commitMessage(...trailers) }), /Conflicting author models/);
      }
    });

    it('accepts several trailers that route to the same reviewer', () => {
      const sonnet = 'Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>';
      assert.deepEqual(selectReviewer({ commitMessage: commitMessage(CLAUDE_TRAILER, sonnet) }), GPT_REVIEWER);
    });

    it('ignores a trailer-shaped line in the body', () => {
      const message = ['feat: x', '', CLAUDE_TRAILER, '', 'More prose.', '', GPT_TRAILER].join('\n');
      assert.deepEqual(selectReviewer({ commitMessage: message }), CLAUDE_REVIEWER);
      const bodyOnly = ['feat: x', '', CLAUDE_TRAILER, '', 'Closing prose.'].join('\n');
      assert.throws(() => selectReviewer({ commitMessage: bodyOnly }), ReviewRoutingError);
    });

    it('reads the final trailer block of every commit in commitMessages', () => {
      const one = { commitMessages: [commitMessage(CLAUDE_TRAILER), commitMessage(CLAUDE_TRAILER)] };
      assert.deepEqual(selectReviewer(one), GPT_REVIEWER);
      const mixed = { commitMessages: [commitMessage(CLAUDE_TRAILER), commitMessage(GPT_TRAILER)] };
      assert.throws(() => selectReviewer(mixed), /Conflicting author models/);
    });

    it('rejects a co-author trailer with an empty email', () => {
      assert.throws(() => selectReviewer({ commitMessage: commitMessage('Co-Authored-By: Claude Opus 5.5 <>') }), ReviewRoutingError);
    });

    it('prefers the author_model field over the trailer', () => {
      const packet = { author_model: 'gpt-6.1-sol', commitMessage: commitMessage(CLAUDE_TRAILER) };
      assert.deepEqual(selectReviewer(packet), CLAUDE_REVIEWER);
    });

    it('falls back to the trailer when author_model is blank', () => {
      const packet = { author_model: '  ', commitMessage: commitMessage(CLAUDE_TRAILER) };
      assert.deepEqual(selectReviewer(packet), GPT_REVIEWER);
    });
  });

  describe('custom matrix', () => {
    const matrix: ReviewerMatrix = [
      { authorPrefix: 'gpt-6.1', reviewer: { provider: 'anthropic', model: 'claude-fable-5' } },
      { authorPrefix: 'gpt-', reviewer: CLAUDE_REVIEWER },
    ];

    it('takes the first matching entry in table order', () => {
      assert.deepEqual(selectReviewer({ author_model: 'gpt-6.1-sol' }, matrix), {
        provider: 'anthropic',
        model: 'claude-fable-5',
      });
      assert.deepEqual(selectReviewer({ author_model: 'gpt-4o' }, matrix), CLAUDE_REVIEWER);
    });

    it('replaces the default matrix instead of extending it', () => {
      assert.throws(() => selectReviewer({ author_model: 'claude-opus-5-5' }, matrix), ReviewRoutingError);
    });
  });

  describe('matrix validation', () => {
    it('rejects an empty author prefix', () => {
      const matrix: ReviewerMatrix = [{ authorPrefix: '', reviewer: GPT_REVIEWER }, { authorPrefix: 'claude-', reviewer: GPT_REVIEWER }];
      assert.throws(() => selectReviewer({ author_model: 'claude-opus-5-5' }, matrix), /empty author prefix/);
    });

    it('rejects a reviewer from the author family', () => {
      const matrix: ReviewerMatrix = [{ authorPrefix: 'claude-', reviewer: CLAUDE_REVIEWER }];
      assert.throws(() => selectReviewer({ author_model: 'claude-opus-5-5' }, matrix), /same model family/);
    });
  });

  describe('fails closed', () => {
    const missing: [string, ReviewPacket][] = [
      ['an empty packet', {}],
      ['an empty author_model', { author_model: '' }],
      ['a commit message without trailers', { commitMessage: commitMessage() }],
      ['a co-author line without an email', { commitMessage: commitMessage('Co-Authored-By: Claude Opus 5.5') }],
      ['a trailer quoted at the end of a sentence', { commitMessage: `docs: explain the trailer ${CLAUDE_TRAILER}` }],
      [
        'two co-authors on one line',
        { commitMessage: commitMessage(`${CLAUDE_TRAILER}, GPT-6.1 Sol <noreply@openai.com>`) },
      ],
    ];
    for (const [name, packet] of missing) {
      it(`rejects ${name}`, () => {
        assert.throws(() => selectReviewer(packet), ReviewRoutingError);
      });
    }

    it('rejects a PR-body-sized co-author line without an email in under a second', () => {
      const hostile = commitMessage(`Co-Authored-By: a${' '.repeat(65_536)}`);
      const start = performance.now();
      assert.throws(() => selectReviewer({ commitMessage: hostile }), ReviewRoutingError);
      assert.ok(performance.now() - start < 1000, 'trailer scan is quadratic in line length');
    });

    const unknown: [string, ReviewPacket, RegExp][] = [
      ['an unknown author_model', { author_model: 'llama-3.3-70b' }, /llama-3\.3-70b/],
      [
        'an unknown author_model without falling back to the trailer',
        { author_model: 'llama-3.3-70b', commitMessage: commitMessage(CLAUDE_TRAILER) },
        /llama-3\.3-70b/,
      ],
      ['a human co-author', { commitMessage: commitMessage(HUMAN_TRAILER) }, /chris-sorensen/],
      [
        'a human co-author listed after a model co-author',
        { commitMessage: commitMessage(CLAUDE_TRAILER, HUMAN_TRAILER) },
        /chris-sorensen/,
      ],
    ];
    for (const [name, packet, author] of unknown) {
      it(`rejects ${name} and names it in the error`, () => {
        assert.throws(
          () => selectReviewer(packet),
          (error: unknown) => error instanceof ReviewRoutingError && author.test(error.message),
        );
      });
    }
  });
});

describe('resolveReviewerProvider', () => {
  const noDotEnv = (): undefined => undefined;

  it('returns an OpenAI provider for an openai route', async () => {
    const urls: string[] = [];
    const provider = resolveReviewerProvider(GPT_REVIEWER, {
      env: { OPENAI_API_KEY: 'test-routing-key' },
      readDotEnv: noDotEnv,
      fetch: async (url) => {
        urls.push(url);
        return Response.json({ choices: [{ index: 0, message: { role: 'assistant', content: '{"findings": []}' } }] });
      },
    });
    assert.equal(await provider.generate(GPT_REVIEWER.model, 'Review this diff'), '{"findings": []}');
    assert.deepEqual(urls, ['https://api.openai.com/v1/chat/completions']);
  });

  it('fails fast when the openai route has no key', () => {
    assert.throws(() => resolveReviewerProvider(GPT_REVIEWER, { env: {}, readDotEnv: noDotEnv }), { message: MISSING_KEY });
  });

  it('returns an Anthropic provider for an anthropic route', async () => {
    const urls: string[] = [];
    const provider = resolveReviewerProvider(CLAUDE_REVIEWER, {
      env: { ANTHROPIC_API_KEY: 'test-routing-key' },
      readDotEnv: noDotEnv,
      fetch: async (url) => {
        urls.push(url);
        return Response.json({ content: [{ type: 'text', text: '{"findings": []}' }] });
      },
    });
    assert.equal(await provider.generate(CLAUDE_REVIEWER.model, 'Review this diff'), '{"findings": []}');
    assert.deepEqual(urls, ['https://api.anthropic.com/v1/messages']);
  });

  it('rejects an unsupported provider instead of returning undefined', () => {
    const route = { provider: 'gemini', model: 'x' } as unknown as ReviewerRoute;
    assert.throws(() => resolveReviewerProvider(route), ReviewRoutingError);
  });

  it('fails fast when the anthropic route has no key', () => {
    assert.throws(() => resolveReviewerProvider(CLAUDE_REVIEWER, { env: {}, readDotEnv: noDotEnv }), {
      message: 'Missing ANTHROPIC_API_KEY for secondary reviewer in dispatch matrix',
    });
  });
});
