import test from 'node:test';
import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import { join } from 'node:path';
import { createSupervisor } from '../modules/runtime-owner/index.mjs';

const fixtureDir = process.env.OPEN_NOTEBOOK_FIXTURE_DIR;
const port = process.env.OPEN_NOTEBOOK_PORT || '18765';
const uvBin = process.env.UV_BIN || 'uv';

async function fixtureAvailable() {
  if (process.platform !== 'linux' || !fixtureDir) return false;
  try { await access(join(fixtureDir, 'pyproject.toml')); } catch { return false; }
  return true;
}

test('Open Notebook consumer lifecycle contract', async (t) => {
  if (!(await fixtureAvailable())) return t.skip('RUNTIME_FIXTURE_UNAVAILABLE');
  const supervisor = createSupervisor();
  const events = [];
  supervisor.onEvent((event) => events.push(event));
  const groupId = await supervisor.createGroup('toolforge', {
    cpu_limit_percent: 100, memory_limit_mb: 1024, max_concurrency: 1,
    timeout_seconds: 30, restart_policy: 'none',
    workflow_id: 'open-notebook-consumer-integration',
  });
  const providerEnv = (process.env.OPEN_NOTEBOOK_PROVIDER_ENV || '').split(',').map((name) => name.trim()).filter(Boolean);
  const env = {
    PATH: process.env.PATH, HOME: process.env.HOME, API_PORT: port, API_RELOAD: 'false',
    OPEN_NOTEBOOK_ENCRYPTION_KEY: process.env.OPEN_NOTEBOOK_ENCRYPTION_KEY || 'phase-b-local-fixture-secret',
    SURREAL_URL: process.env.SURREAL_URL || 'ws://127.0.0.1:8000/rpc',
    SURREAL_USER: process.env.SURREAL_USER || 'root',
    SURREAL_PASSWORD: process.env.SURREAL_PASSWORD || 'root',
    SURREAL_NAMESPACE: process.env.SURREAL_NAMESPACE || 'open_notebook',
    SURREAL_DATABASE: process.env.SURREAL_DATABASE || 'open_notebook',
  };
  for (const name of providerEnv) if (process.env[name] !== undefined) env[name] = process.env[name];
  await supervisor.spawnInGroup(groupId,
    [uvBin, 'run', '--with', 'uvicorn', 'python', 'run_api.py'], env, fixtureDir);
  try {
    const deadline = Date.now() + 30_000;
    let healthy = false;
    while (Date.now() < deadline) {
      try {
        const response = await fetch(`http://127.0.0.1:${port}/health`);
        healthy = response.ok && (await response.json()).status === 'healthy';
        if (healthy) break;
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    assert.equal(healthy, true, events.filter((event) => event.event_type === 'process_output').map((event) => `${event.stream}: ${event.data}`).join(''));
    const response = await fetch(`http://127.0.0.1:${port}/chat/execute`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ session_id: 'runtime-owner-integration-001', message: 'health check', context: {} }),
    });
    assert.equal(response.ok, true);
  } finally {
    await supervisor.terminateGroup(groupId, 2);
    assert.equal((await supervisor.getGroupStatus(groupId)).state, 'closed');
  }
});
