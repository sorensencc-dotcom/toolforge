import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DEFENSIVE_RULES, parseReview } from './adversarial-review.ts';

const FENCE = '```';
const SUMMARY = 'Connection release races with acquire';
const MALFORMED = { findings: [], noise: [], suppressed: [], flags: ['malformed'], pass: false };

function finding(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'F1',
    file: 'src/tx/pool.ts',
    summary: SUMMARY,
    trigger: 'Two workers release the same connection in one event-loop tick',
    likelihood: 0.5,
    cost: 8,
    fixRecipe: 'Serialize release through the pool mutex',
    ...overrides,
  };
}

function findingsWithRisks(risks: number[]): Record<string, unknown>[] {
  return risks.map((risk) => finding({ id: `F${risk}`, likelihood: 1, cost: risk }));
}

function review(findings: unknown[], noise: unknown[] = []): string {
  return JSON.stringify({ findings, noise });
}

describe('parseReview', () => {
  it('returns a valid finding with risk computed as likelihood times cost', () => {
    assert.deepEqual(parseReview(review([finding()])), {
      findings: [
        {
          id: 'F1',
          file: 'src/tx/pool.ts',
          summary: SUMMARY,
          trigger: 'Two workers release the same connection in one event-loop tick',
          likelihood: 0.5,
          cost: 8,
          risk: 4,
          fixRecipe: 'Serialize release through the pool mutex',
        },
      ],
      noise: [],
      suppressed: [],
      flags: [],
      pass: false,
    });
  });

  for (const [name, text] of [
    ['an empty noise list', '{"findings": [], "noise": []}'],
    ['no noise key', '{"findings": []}'],
  ] as const) {
    it(`passes a review with no findings and ${name}`, () => {
      assert.deepEqual(parseReview(text), { findings: [], noise: [], suppressed: [], flags: [], pass: true });
    });
  }

  describe('risk and ranking', () => {
    it('replaces a model-supplied risk with likelihood times cost and ranks by it', () => {
      const outcome = parseReview(
        review([
          finding({ id: 'A', likelihood: 0.25, cost: 4, risk: 9 }),
          finding({ id: 'B', likelihood: 0.5, cost: 8, risk: 0 }),
        ]),
      );
      assert.deepEqual(
        outcome.findings.map((f) => [f.id, f.risk]),
        [
          ['B', 4],
          ['A', 1],
        ],
      );
    });

    it('gates on the recomputed risk, not the model-supplied one', () => {
      assert.equal(parseReview(review([finding({ likelihood: 0.5, cost: 8, risk: 0 })])).pass, false);
      assert.equal(parseReview(review([finding({ likelihood: 0.25, cost: 4, risk: 9 })])).pass, true);
    });

    it('keeps the 7 highest-risk findings in descending order and flags the cap', () => {
      const outcome = parseReview(review(findingsWithRisks([5, 9, 1, 7, 3, 8, 2, 6, 4])));
      assert.deepEqual(
        outcome.findings.map((f) => f.risk),
        [9, 8, 7, 6, 5, 4, 3],
      );
      assert.deepEqual(outcome.flags, ['capped']);
      assert.deepEqual(outcome.noise, []);
    });

    it('does not flag a review with exactly 7 findings', () => {
      const outcome = parseReview(review(findingsWithRisks([1, 2, 3, 4, 5, 6, 7])));
      assert.equal(outcome.findings.length, 7);
      assert.deepEqual(outcome.flags, []);
    });

    it('counts only valid findings toward the cap', () => {
      const outcome = parseReview(
        review([
          ...findingsWithRisks([1, 2, 3, 4, 5, 6, 7]),
          finding({ id: 'untriggered', likelihood: 1, cost: 10, trigger: undefined }),
        ]),
      );
      assert.deepEqual(
        outcome.findings.map((f) => f.risk),
        [7, 6, 5, 4, 3, 2, 1],
      );
      assert.deepEqual(outcome.flags, []);
    });

    it('orders findings of equal risk by ascending id', () => {
      const outcome = parseReview(
        review([
          finding({ id: 'c', likelihood: 1, cost: 2 }),
          finding({ id: 'a', likelihood: 0.5, cost: 4 }),
          finding({ id: 'b', likelihood: 0.25, cost: 8 }),
        ]),
      );
      assert.deepEqual(
        outcome.findings.map((f) => f.id),
        ['a', 'b', 'c'],
      );
    });
  });

  describe('pass threshold', () => {
    it('blocks when a finding risk equals the default threshold of 3', () => {
      assert.equal(parseReview(review([finding({ likelihood: 0.5, cost: 6 })])).pass, false);
    });

    it('passes when every finding is below the default threshold', () => {
      assert.equal(parseReview(review([finding({ likelihood: 0.5, cost: 5 })])).pass, true);
    });

    it('applies a configured threshold', () => {
      assert.equal(parseReview(review([finding({ likelihood: 0.5, cost: 6 })]), { threshold: 3.5 }).pass, true);
      assert.equal(parseReview(review([finding({ likelihood: 0.5, cost: 5 })]), { threshold: 2.5 }).pass, false);
    });

    it('blocks when likelihood times cost lands exactly on a fractional threshold', () => {
      const outcome = parseReview(review([finding({ likelihood: 0.3, cost: 9 })]), { threshold: 2.7 });
      assert.equal(outcome.findings[0].risk, 2.7);
      assert.equal(outcome.pass, false);
    });

    it('fails closed when the threshold is NaN', () => {
      assert.equal(parseReview(review([finding({ likelihood: 0, cost: 1 })]), { threshold: Number.NaN }).pass, false);
    });
  });

  describe('findings without a concrete trigger', () => {
    for (const [name, trigger] of [
      ['a missing', undefined],
      ['an empty', ''],
      ['a blank', ' \n\t '],
    ] as const) {
      it(`moves a finding with ${name} trigger to noise without blocking`, () => {
        const outcome = parseReview(review([finding({ trigger, likelihood: 0.9, cost: 10 })]));
        assert.deepEqual(outcome.findings, []);
        assert.equal(outcome.pass, true);
        assert.equal(outcome.noise.length, 1);
        assert.equal(outcome.noise[0].summary, SUMMARY);
        assert.match(outcome.noise[0].whyHypothetical, /trigger/i);
      });
    }
  });

  describe('findings with invalid fields', () => {
    const cases: [string, Record<string, unknown>][] = [
      ['likelihood below 0', { likelihood: -0.1 }],
      ['likelihood above 1', { likelihood: 1.5 }],
      ['likelihood as a string', { likelihood: '0.9' }],
      ['likelihood as a percentage', { likelihood: 80 }],
      ['NaN-like likelihood', { likelihood: null }],
      ['cost below 1', { cost: 0.5 }],
      ['cost above 10', { cost: 11 }],
      ['no cost', { cost: undefined }],
      ['a numeric id', { id: 7 }],
      ['a non-string file', { file: ['src/tx/pool.ts'] }],
      ['a null summary', { summary: null }],
      ['no fixRecipe', { fixRecipe: undefined }],
    ];
    for (const [name, overrides] of cases) {
      it(`fails the whole review closed on a finding with ${name}`, () => {
        const outcome = parseReview(review([finding({ likelihood: 0.9, cost: 10, ...overrides })]));
        assert.deepEqual(outcome, MALFORMED);
      });
    }

    it('discards valid, suppressed, and noise entries alongside an invalid one', () => {
      const outcome = parseReview(
        review(
          [
            finding({ id: 'ok', likelihood: 1, cost: 10 }),
            finding({ id: 'bait', likelihood: 0.05, fixRecipe: 'Add a null check before reading config.timeout' }),
            finding({ id: 'bad', cost: 11 }),
          ],
          [{ summary: 'n', whyHypothetical: 'w' }],
        ),
      );
      assert.deepEqual(outcome, MALFORMED);
    });

    it('fails closed on a non-object finding', () => {
      const outcome = parseReview(review([SUMMARY]));
      assert.deepEqual(outcome, MALFORMED);
    });

    it('accepts likelihood and cost on their range bounds', () => {
      const outcome = parseReview(
        review([
          finding({ id: 'floor', likelihood: 0, cost: 1 }),
          finding({ id: 'ceiling', likelihood: 1, cost: 10 }),
        ]),
      );
      assert.deepEqual(
        outcome.findings.map((f) => [f.id, f.risk]),
        [
          ['ceiling', 10],
          ['floor', 0],
        ],
      );
      assert.deepEqual(outcome.noise, []);
    });
  });

  describe('fenced output', () => {
    const recipe = `Serialize release:\n${FENCE}ts\nawait mutex.runExclusive(release);\n${FENCE}`;
    const body = review([finding({ fixRecipe: recipe })]);
    for (const [name, text] of [
      ['a json-tagged fence', `  ${FENCE}json\n${body}\n${FENCE}\n`],
      ['an untagged fence', `${FENCE}\n${body}\n${FENCE}`],
    ] as const) {
      it(`parses a review in ${name}, including a fix recipe with its own fence`, () => {
        const outcome = parseReview(text);
        assert.deepEqual(outcome.flags, []);
        assert.deepEqual(
          outcome.findings.map((f) => f.fixRecipe),
          [recipe],
        );
      });
    }
  });

  describe('malformed output', () => {
    const cases: [string, string][] = [
      ['empty text', ''],
      ['prose', 'The diff looks safe to merge.'],
      ['truncated JSON', '{"findings": [{"id": "F1"'],
      ['a JSON array', '[]'],
      ['JSON null', 'null'],
      ['an object without findings', '{"noise": []}'],
      ['findings that are not a list', '{"findings": "none", "noise": []}'],
      ['a fence around invalid JSON', `${FENCE}json\n{findings: []}\n${FENCE}`],
      ['prose around a fenced review', `Here is the review:\n${FENCE}json\n{"findings": [], "noise": []}\n${FENCE}`],
    ];
    for (const [name, text] of cases) {
      it(`fails closed on ${name}`, () => {
        assert.deepEqual(parseReview(text), MALFORMED);
      });
    }
  });

  describe('model noise', () => {
    it('passes through well-formed noise items and drops malformed ones', () => {
      const outcome = parseReview(
        review(
          [],
          [
            { summary: 'Pool size could overflow', whyHypothetical: 'Needs more than 2^31 open connections' },
            { summary: 'Missing its reason' },
            'bare string',
            { summary: 7, whyHypothetical: 'Numeric summary' },
          ],
        ),
      );
      assert.deepEqual(outcome.noise, [
        { summary: 'Pool size could overflow', whyHypothetical: 'Needs more than 2^31 open connections' },
      ]);
    });
  });

  describe('over-validation circuit breaker', () => {
    const baitSummary = 'acquire() trusts the options object built by createPool';
    const baitRecipe = 'Add input validation for every PoolOptions field';

    function bait(overrides: Record<string, unknown> = {}): Record<string, unknown> {
      return finding({
        id: 'bait',
        summary: baitSummary,
        trigger: 'A future caller passes options without timeoutMs',
        likelihood: 0.05,
        cost: 10,
        fixRecipe: baitRecipe,
        ...overrides,
      });
    }

    it('suppresses a low-likelihood redundant-validation finding and passes at a threshold its risk meets', () => {
      assert.deepEqual(parseReview(review([bait()]), { threshold: 0.5 }), {
        findings: [],
        noise: [],
        suppressed: [
          {
            id: 'bait',
            file: 'src/tx/pool.ts',
            summary: baitSummary,
            trigger: 'A future caller passes options without timeoutMs',
            likelihood: 0.05,
            cost: 10,
            risk: 0.5,
            fixRecipe: baitRecipe,
            rule: 'input-validation',
          },
        ],
        flags: [],
        pass: true,
      });
    });

    it('keeps a defensive finding whose likelihood is exactly 0.1', () => {
      const outcome = parseReview(review([bait({ likelihood: 0.1 })]), { threshold: 0.5 });
      assert.deepEqual(
        outcome.findings.map((f) => f.id),
        ['bait'],
      );
      assert.deepEqual(outcome.suppressed, []);
      assert.equal(outcome.pass, false);
    });

    it('keeps a high-likelihood defensive finding blocking', () => {
      const outcome = parseReview(review([bait({ likelihood: 0.9 })]));
      assert.deepEqual(
        outcome.findings.map((f) => f.id),
        ['bait'],
      );
      assert.deepEqual(outcome.suppressed, []);
      assert.equal(outcome.pass, false);
    });

    it('keeps a low-likelihood finding that recommends no defensive code', () => {
      const outcome = parseReview(review([finding({ likelihood: 0.05, cost: 10 })]), { threshold: 0.5 });
      assert.deepEqual(
        outcome.findings.map((f) => f.id),
        ['F1'],
      );
      assert.deepEqual(outcome.suppressed, []);
      assert.equal(outcome.pass, false);
    });

    it('suppresses before the cap, so a suppressed finding takes no slot and sets no flag', () => {
      const outcome = parseReview(review([...findingsWithRisks([1, 2, 3, 4, 5, 6, 7]), bait()]));
      assert.deepEqual(
        outcome.findings.map((f) => f.risk),
        [7, 6, 5, 4, 3, 2, 1],
      );
      assert.deepEqual(outcome.flags, []);
      assert.deepEqual(
        outcome.suppressed.map((f) => f.id),
        ['bait'],
      );
    });

    it('ranks suppressed findings by descending risk', () => {
      const outcome = parseReview(
        review([bait({ id: 'low', likelihood: 0.02, cost: 5 }), bait({ id: 'high', likelihood: 0.08, cost: 10 })]),
      );
      assert.deepEqual(
        outcome.suppressed.map((f) => [f.id, f.risk]),
        [
          ['high', 0.8],
          ['low', 0.1],
        ],
      );
    });

    it('sends a defensive finding without a trigger to noise, not suppressed', () => {
      const outcome = parseReview(review([bait({ trigger: undefined })]));
      assert.deepEqual(outcome.suppressed, []);
      assert.deepEqual(
        outcome.noise.map((n) => n.summary),
        [baitSummary],
      );
    });

    const ruleCases: [string, 'summary' | 'fixRecipe', string][] = [
      ['null-check', 'summary', 'Missing null check on config.timeout'],
      ['null-check', 'fixRecipe', 'Check for undefined before calling release()'],
      ['type-check', 'fixRecipe', 'Add runtime type checks for every PoolOptions field'],
      ['input-validation', 'fixRecipe', baitRecipe],
      ['input-validation', 'fixRecipe', 'Validate the arguments of the internal normalizePath helper'],
      ['guard-layer', 'fixRecipe', 'Put a guard clause at the top of acquire()'],
      ['guard-layer', 'fixRecipe', 'Add a wrapper that checks pool state before each call'],
      ['defensive-boilerplate', 'summary', 'Options are not defensively copied'],
      ['defensive-boilerplate', 'fixRecipe', 'Re-read the pool size just in case'],
      ['defensive-boilerplate', 'fixRecipe', 'Clamp the timeout to be safe'],
      ['defensive-boilerplate', 'fixRecipe', 'Wrap the release() call in a try/catch'],
    ];
    for (const [rule, field, text] of ruleCases) {
      for (const [casing, variant] of [
        ['', text],
        [' in upper case', text.toUpperCase()],
      ] as const) {
        it(`records rule ${rule} for a ${field} of "${text}"${casing}`, () => {
          const outcome = parseReview(review([finding({ likelihood: 0.05, [field]: variant })]));
          assert.deepEqual(outcome.findings, []);
          assert.deepEqual(
            outcome.suppressed.map((f) => f.rule),
            [rule],
          );
        });
      }
    }

    it('has an example case for every exported rule', () => {
      assert.deepEqual(new Set(ruleCases.map(([rule]) => rule)), new Set(DEFENSIVE_RULES.map(({ name }) => name)));
    });
  });
});
