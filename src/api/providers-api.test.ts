import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import express from 'express';
import { getProvider, resetProvider } from '../providers/index.js';
import { setupProviderRoutes } from './providers-api.ts';
import { auditWithOllama } from '../providers/usage-examples.ts';

const MARKER = 'pw-marker';
const SECRET_URL = ['http://probe', MARKER].join(':') + '@10.0.0.5:11434/v1';
const verdictJson = JSON.stringify({ consensus: true, blockerAnalysis: 'Clean', targetedFixRecipe: 'None' });
const auditPacket = {
  packetId: 'pkt-api-001',
  specGoal: 'Release the lock on timeout',
  declaredScope: ['src/tx/lock.ts'],
  testOutput: 'AssertionError: lock timeout did not fire',
  appliedDiff: '+setTimeout(resolve, 1000);',
  historyLog: ['Turn 1: raised the timer'],
};

describe('providers-api example', () => {
  let server: Server;
  let base: string;
  let previousBaseUrl: string | undefined;

  before(async () => {
    previousBaseUrl = process.env.OLLAMA_BASE_URL;
    process.env.OLLAMA_BASE_URL = SECRET_URL;
    resetProvider();
    getProvider({ selection: {} }).generate = async () => verdictJson;
    const app = express();
    app.use(express.json());
    setupProviderRoutes(app);
    server = app.listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
    resetProvider();
    if (previousBaseUrl === undefined) delete process.env.OLLAMA_BASE_URL;
    else process.env.OLLAMA_BASE_URL = previousBaseUrl;
  });

  it('health response never exposes the provider endpoint', async () => {
    const res = await fetch(`${base}/health/provider`);
    const text = await res.text();
    assert.equal(res.status, 200);
    assert.equal('endpoint' in JSON.parse(text), false);
    assert.equal(text.includes(MARKER) || text.includes('10.0.0.5'), false);
  });

  it('audit route returns the verdict from the .ts auditor', async () => {
    const res = await fetch(`${base}/api/audit`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(auditPacket),
    });
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.verdict.consensus, true);
  });

  it('usage-examples auditWithOllama runs through the shared provider', async () => {
    const verdict = await auditWithOllama(auditPacket);
    assert.equal(verdict.consensus, true);
  });
});
