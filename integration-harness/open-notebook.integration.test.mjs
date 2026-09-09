import test from 'node:test';
import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import { join } from 'node:path';
import { createSupervisor } from '../modules/runtime-owner/index.mjs';

const fixtureDir = process.env.OPEN_NOTEBOOK_FIXTURE_DIR;
const port = process.env.OPEN_NOTEBOOK_PORT || '18765';
const pythonBin = process.env.OPEN_NOTEBOOK_PYTHON || join(fixtureDir || '', '.venv', 'bin', 'python');

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
    [pythonBin, 'run_api.py'], env, fixtureDir);
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
    if (!process.env.OPEN_NOTEBOOK_PROVIDER_ENV) return t.skip('NO_PROVIDER_CONFIGURED (health-only mode)');
    const notebook = await fetch(`http://127.0.0.1:${port}/api/notebooks`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'runtime-owner-integration', description: 'bounded fixture' }),
    });
    assert.equal(notebook.ok, true);
    const notebookBody = await notebook.json();
    const session = await fetch(`http://127.0.0.1:${port}/api/chat/sessions`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ notebook_id: notebookBody.id, title: 'runtime-owner-integration' }),
    });
    assert.equal(session.ok, true);
    const sessionBody = await session.json();
    const response = await fetch(`http://127.0.0.1:${port}/api/chat/execute`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ session_id: sessionBody.id, message: 'health check', context: {} }),
    });
    assert.equal(response.ok, true);
  } finally {
    await supervisor.terminateGroup(groupId, 2);
    assert.equal((await supervisor.getGroupStatus(groupId)).state, 'closed');
  }
});
