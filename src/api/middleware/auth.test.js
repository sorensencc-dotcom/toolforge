import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultResolveUser, requireAuth } from './auth.js';

function withEnv(env, fn) {
  const previous = {
    NODE_ENV: process.env.NODE_ENV,
    TOOLFORGE_DEV_HEADER_AUTH: process.env.TOOLFORGE_DEV_HEADER_AUTH,
  };

  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }

  try {
    return fn();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

function checkRequireAuth(req) {
  let status;
  let body;
  let nextCalled = false;
  const res = {
    status(value) {
      status = value;
      return this;
    },
    json(value) {
      body = value;
      return this;
    },
  };

  req.userId = defaultResolveUser(req);
  requireAuth(req, res, () => {
    nextCalled = true;
  });
  return { status, body, nextCalled, userId: req.userId };
}

test('x-user-id is ignored outside explicitly enabled development mode', async (t) => {
  for (const nodeEnv of ['production', 'test']) {
    await t.test(`NODE_ENV=${nodeEnv}`, () => {
      withEnv({ NODE_ENV: nodeEnv, TOOLFORGE_DEV_HEADER_AUTH: '1' }, () => {
        const result = checkRequireAuth({
          headers: { 'x-user-id': 'header-user' },
        });
        assert.equal(result.userId, null);
        assert.equal(result.status, 401);
        assert.deepEqual(result.body, { error: 'Authentication required' });
        assert.equal(result.nextCalled, false);
      });
    });
  }
});

test('x-user-id is accepted in development when the opt-in flag is enabled', () => {
  withEnv({ NODE_ENV: 'development', TOOLFORGE_DEV_HEADER_AUTH: '1' }, () => {
    const result = checkRequireAuth({
      headers: { 'x-user-id': '  dev-user  ' },
    });
    assert.equal(result.userId, 'dev-user');
    assert.equal(result.status, undefined);
    assert.equal(result.nextCalled, true);
  });
});

test('x-user-id is ignored in development without the opt-in flag', () => {
  withEnv({ NODE_ENV: 'development', TOOLFORGE_DEV_HEADER_AUTH: undefined }, () => {
    const result = checkRequireAuth({
      headers: { 'x-user-id': 'header-user' },
    });
    assert.equal(result.userId, null);
    assert.equal(result.status, 401);
    assert.deepEqual(result.body, { error: 'Authentication required' });
    assert.equal(result.nextCalled, false);
  });
});

test('session userId remains honored when header authentication is disabled', () => {
  withEnv({ NODE_ENV: 'production', TOOLFORGE_DEV_HEADER_AUTH: undefined }, () => {
    const result = checkRequireAuth({
      headers: { 'x-user-id': 'header-user' },
      session: { userId: 'session-user' },
    });
    assert.equal(result.userId, 'session-user');
    assert.equal(result.status, undefined);
    assert.equal(result.nextCalled, true);
  });
});
