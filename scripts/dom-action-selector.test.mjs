/**
 * scripts/dom-action-selector.test.mjs
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { selectDomAction } from './dom-action-selector.mjs';

test('Fast-path matches cookie consent acceptance', async () => {
  const elements = [
    { id: 'btn-cookie-accept', tag: 'button', text: 'Accept Cookies' },
    { id: 'btn-cookie-reject', tag: 'button', text: 'Decline' },
  ];

  const result = await selectDomAction('Dismiss cookie banner', elements);
  assert.equal(result.action, 'CLICK');
  assert.equal(result.targetElementId, 'btn-cookie-accept');
  assert.equal(result.confidence, 0.98);
});

test('Fast-path identifies single input field when typing is requested', async () => {
  const elements = [
    { id: 'search-input', tag: 'input', placeholder: 'Search repository...' },
    { id: 'nav-link', tag: 'a', text: 'Home' },
  ];

  const result = await selectDomAction('search for react documentation', elements);
  assert.equal(result.action, 'TYPE_REQUIRED');
  assert.equal(result.targetElementId, 'search-input');
});

test('Jev Choice selects correct navigation target from candidate space', async () => {
  const elements = [
    { id: 'item-101', tag: 'a', text: 'Pricing & Plans' },
    { id: 'item-102', tag: 'a', text: 'Documentation & API Reference' },
    { id: 'item-103', tag: 'a', text: 'Contact Sales' },
  ];

  const mockFetch = async () => ({
    ok: true,
    json: async () => ({
      answers: {
        target_action: {
          choice: 'item-102',
          confidence: 0.91,
        },
      },
    }),
  });

  const result = await selectDomAction('View the developer API guides', elements, { fetchImpl: mockFetch });
  assert.equal(result.action, 'CLICK');
  assert.equal(result.targetElementId, 'item-102');
  assert.equal(result.confidence, 0.91);
});

test('Jev Choice returns NO_MATCH when no element applies', async () => {
  const elements = [
    { id: 'item-1', tag: 'a', text: 'About Us' },
    { id: 'item-2', tag: 'a', text: 'Terms of Service' },
  ];

  const mockFetch = async () => ({
    ok: true,
    json: async () => ({
      answers: {
        target_action: {
          choice: 'NO_MATCH',
          confidence: 0.85,
        },
      },
    }),
  });

  const result = await selectDomAction('Download quarterly financial report', elements, { fetchImpl: mockFetch });
  assert.equal(result.action, 'NO_MATCH');
  assert.equal(result.targetElementId, null);
});

test('Fail-safe returns NO_MATCH when Jev is unreachable', async () => {
  const elements = [{ id: 'random-btn', tag: 'button', text: 'Mystery Button' }];

  const mockFetchFail = async () => {
    throw new Error('ECONNREFUSED');
  };

  const result = await selectDomAction('Do something complex', elements, { fetchImpl: mockFetchFail });
  assert.equal(result.action, 'NO_MATCH');
  assert.equal(result.targetElementId, null);
});
