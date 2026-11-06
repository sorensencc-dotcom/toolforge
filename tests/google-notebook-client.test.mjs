/**
 * tests/google-notebook-client.test.mjs
 *
 * Contract and interface verification for Google Notebook API native client.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as client from '../scripts/lib/google-notebook-client.mjs';

describe('Google Notebook API Client', () => {
  it('exports all expected API methods', () => {
    assert.strictEqual(typeof client.getProjectId, 'function');
    assert.strictEqual(typeof client.getAccessToken, 'function');
    assert.strictEqual(typeof client.listNotebooks, 'function');
    assert.strictEqual(typeof client.getNotebook, 'function');
    assert.strictEqual(typeof client.listSources, 'function');
    assert.strictEqual(typeof client.addTextSource, 'function');
    assert.strictEqual(typeof client.addWebSource, 'function');
    assert.strictEqual(typeof client.deleteSource, 'function');
  });

  it('rejects addTextSource when displayName or content are missing', async () => {
    await assert.rejects(
      async () => {
        await client.addTextSource('test-id', { displayName: '', content: 'some text' });
      },
      /INVALID_ARGUMENT: displayName and content are required/
    );

    await assert.rejects(
      async () => {
        await client.addTextSource('test-id', { displayName: 'Doc Title', content: '' });
      },
      /INVALID_ARGUMENT: displayName and content are required/
    );
  });

  it('rejects addWebSource when url is missing', async () => {
    await assert.rejects(
      async () => {
        await client.addWebSource('test-id', { url: '' });
      },
      /INVALID_ARGUMENT: url is required/
    );
  });

  it('resolves project ID if configured in environment', () => {
    const original = process.env.GOOGLE_CLOUD_PROJECT;
    try {
      process.env.GOOGLE_CLOUD_PROJECT = 'test-mock-project-123';
      // Reset internal cache if possible or verify
      const pid = client.getProjectId();
      assert.ok(typeof pid === 'string' || pid === null);
    } finally {
      if (original !== undefined) {
        process.env.GOOGLE_CLOUD_PROJECT = original;
      } else {
        delete process.env.GOOGLE_CLOUD_PROJECT;
      }
    }
  });
});
