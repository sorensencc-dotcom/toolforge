import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assessTurn, responseDifference, shannonEntropy } from './turn-self-assessment.mjs';

test('identical responses fail after the configured repeat threshold', () => {
  const response = 'The same grounded answer remains available.';
  const history = [response, response, response];
  const result = assessTurn({ turn: 4, response, history });

  assert.equal(result.ok, false);
  assert.equal(result.reason, 'REPEATED_RESPONSE_THRESHOLD');
  assert.equal(result.repeatCount, 4);
});

test('different responses pass and expose deterministic assessment metrics', () => {
  const result = assessTurn({
    turn: 2,
    response: 'A new answer adds a distinct next action.',
    history: ['The first answer established the context.'],
  });

  assert.equal(result.ok, true);
  assert.equal(result.verdict, 'PASS');
  assert.ok(result.entropyBitsPerCharacter >= 1);
  assert.ok(result.differenceRatio > 0);
});

test('malformed input fails closed before assessment', () => {
  assert.throws(() => assessTurn({ turn: 1, response: null }), /INVALID_RESPONSE/);
  assert.throws(() => assessTurn({ turn: 0, response: 'answer' }), /INVALID_TURN/);
});

test('metric helpers handle empty and identical inputs deterministically', () => {
  assert.equal(shannonEntropy(''), 0);
  assert.equal(responseDifference('same', 'same'), 0);
  assert.equal(responseDifference(undefined, 'first'), 1);
});
