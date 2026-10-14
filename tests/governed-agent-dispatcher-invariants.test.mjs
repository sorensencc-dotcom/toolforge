import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { triageAndDigest } from '../skills/repo-triage-and-digest/src/pipeline.mjs';

test('Invariant I: Hard Attempt Ceiling (enforces max 3 sequential attempts)', () => {
  const inlinePy = `
import sys, json
sys.path.insert(0, "C:/dev/tools/agent-dispatch")
from dispatcher import dispatch

routes = [
    {"provider": "subscription-cli", "model": "claude-3-7-sonnet"},
    {"provider": "ollama", "model": "qwen2.5-coder:32b"},
    {"provider": "openrouter", "model": "anthropic/claude-3.5-sonnet"},
    {"provider": "spare-fallback", "model": "mistral-large"}
]
contract = {
    "task": "task-triage-kb-sync-trm-001",
    "recommended_route": routes[0],
    "allowed_routes": routes,
    "max_attempts": 4,
    "operator_override": False
}
invoked = []
def adapter(route, task, ctx):
    invoked.append(route["provider"])
    return {"status": "failed", "failure_class": "TIMEOUT", "cost": 0.0}

options = {
    "verification": {"valid": True, "contract_hash": "sha256:contract-kb-sync-trm"},
    "operator_identity": "operator@toolforge.local",
    "catalog": routes,
    "adapters": {r["provider"]: adapter for r in routes}
}
res = dispatch(contract, options)
print(json.dumps({"result": res, "invoked": invoked}))
`;
  const run = spawnSync('python', ['-c', inlinePy], { encoding: 'utf-8' });
  assert.equal(run.status, 0, `Python failed with stderr: ${run.stderr}`);

  const parsed = JSON.parse(run.stdout.trim());
  assert.equal(parsed.result.final_status, 'failed');
  assert.equal(parsed.result.termination_reason, 'ATTEMPTS_EXHAUSTED');
  assert.equal(parsed.result.reason, 'ATTEMPTS_EXHAUSTED');
  assert.equal(parsed.result.attempts.length, 3);
  assert.deepEqual(parsed.invoked, ['subscription-cli', 'ollama', 'openrouter']);
  assert.equal(parsed.invoked.includes('spare-fallback'), false);
});

test('Invariant II: Short-Circuit on Recovery (bypasses subsequent routes on success)', () => {
  const inlinePy = `
import sys, json
sys.path.insert(0, "C:/dev/tools/agent-dispatch")
from dispatcher import dispatch

routes = [
    {"provider": "subscription-cli", "model": "claude-3-7-sonnet"},
    {"provider": "ollama", "model": "qwen2.5-coder:32b"},
    {"provider": "openrouter", "model": "anthropic/claude-3.5-sonnet"}
]
contract = {
    "task": "task-triage-kb-sync-trm-001",
    "recommended_route": routes[0],
    "allowed_routes": routes,
    "max_attempts": 3,
    "operator_override": False
}
invoked = []
def adapter_one(r, t, c):
    invoked.append(r["provider"])
    return {"status": "failed", "failure_class": "TIMEOUT", "cost": 0.0}

def adapter_two(r, t, c):
    invoked.append(r["provider"])
    return {"status": "succeeded", "cost": 0.0015, "failure_class": None}

options = {
    "verification": {"valid": True, "contract_hash": "sha256:contract-kb-sync-trm"},
    "operator_identity": "operator@toolforge.local",
    "catalog": routes,
    "adapters": {
        "subscription-cli": adapter_one,
        "ollama": adapter_two,
        "openrouter": lambda r, t, c: {"status": "failed"}
    }
}
res = dispatch(contract, options)
print(json.dumps({"result": res, "invoked": invoked}))
`;
  const run = spawnSync('python', ['-c', inlinePy], { encoding: 'utf-8' });
  assert.equal(run.status, 0, `Python failed with stderr: ${run.stderr}`);

  const parsed = JSON.parse(run.stdout.trim());
  assert.equal(parsed.result.final_status, 'succeeded');
  assert.equal(parsed.result.final_provider, 'ollama');
  assert.equal(parsed.result.termination_reason, 'completed');
  assert.equal(parsed.result.attempts.length, 2);
  assert.deepEqual(parsed.invoked, ['subscription-cli', 'ollama']);
  assert.equal(parsed.invoked.includes('openrouter'), false);
});

test('Invariant III: Atomic Lifecycle Trace Emission (persists trace.json and result.json)', () => {
  const tmpdir = fs.mkdtempSync(path.join(os.tmpdir(), 'dispatch-trace-'));
  try {
    const inlinePy = `
import sys, json, tempfile
sys.path.insert(0, "C:/dev/tools/agent-dispatch")
from run import execute_dispatch_run

routes = [
    {"provider": "subscription-cli", "model": "claude-3-7-sonnet"},
    {"provider": "ollama", "model": "qwen2.5-coder:32b"},
    {"provider": "openrouter", "model": "anthropic/claude-3.5-sonnet"}
]
contract = {
    "task": "task-triage-kb-sync-trm-001",
    "recommended_route": routes[0],
    "allowed_routes": routes,
    "max_attempts": 3,
    "operator_override": False
}
adapters = {
    r["provider"]: lambda route, task, ctx: {"status": "failed", "failure_class": "TIMEOUT", "cost": 0.0}
    for r in routes
}
options = {
    "verification": {"valid": True, "contract_hash": "sha256:contract-kb-sync-trm"},
    "operator_identity": "operator@toolforge.local",
    "catalog": routes,
    "adapters": adapters
}
res = execute_dispatch_run(
    contract=contract,
    options=options,
    output_dir=r"${tmpdir.replaceAll('\\', '/')}",
    trace_filename="trace.json",
    truncate_trace=True
)
print(json.dumps({"summary": res["summary"]}))
`;
    const run = spawnSync('python', ['-c', inlinePy], { encoding: 'utf-8' });
    assert.equal(run.status, 0, `Python failed with stderr: ${run.stderr}`);

    const resultPath = path.join(tmpdir, 'result.json');
    const tracePath = path.join(tmpdir, 'trace.json');
    assert.equal(fs.existsSync(resultPath), true);
    assert.equal(fs.existsSync(tracePath), true);

    const resultData = JSON.parse(fs.readFileSync(resultPath, 'utf-8'));
    assert.equal(resultData.final_status, 'failed');
    assert.equal(resultData.termination_reason, 'ATTEMPTS_EXHAUSTED');
    assert.equal(resultData.attempts.length, 3);

    const traceLines = fs.readFileSync(tracePath, 'utf-8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
    const events = traceLines.map((e) => e.event);
    assert.deepEqual(events, ['dispatch_start', 'attempt', 'attempt', 'attempt', 'dispatch_end']);
  } finally {
    fs.rmSync(tmpdir, { recursive: true, force: true });
  }
});

test('Invariant IV: Zero-Persistence Token & Remote Context Protection', () => {
  // Remote evaluation invariants
  const remote = triageAndDigest({
    repositoryUrl: 'https://github.com/sorensencc-dotcom/kb-sync',
    targetModules: ['modules/trm/*', 'core/*'],
    excludePatterns: 'tests/*,docs/*,*.lock,*.png,*.html',
    maxFileSizeKb: 50,
    authToken: 'ghp_ephemeral_token_do_not_persist'
  });

  assert.equal(remote.status, 'success');
  assert.equal(remote.data.ingestionDigest.content, null);
  assert.equal(remote.data.visualArchitecture.interactiveDiagramUrl, 'https://gitdiagram.com/sorensencc-dotcom/kb-sync');
  assert.match(remote.data.ingestionDigest.ingestUrl, /^https:\/\/gitingest\.com\/sorensencc-dotcom\/kb-sync\?/);
  assert.deepEqual(remote.telemetry.capabilitiesVerified, ['repo:read', 'repo:visualize', 'repo:ingest']);
  assert.equal(JSON.stringify(remote).includes('ghp_ephemeral_token_do_not_persist'), false);

  // Local extraction invariants: 50 kB cap, path filtering, credential discarding
  const localRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'kb-sync-invariants-'));
  try {
    const files = {
      'modules/trm/query-expander.mjs': 'export const queryExpander = true;\n',
      'modules/trm/ast-grounding.mjs': 'export const astGrounding = true;\n',
      'modules/trm/gap-triage-engine.mjs': 'export const gapTriageEngine = true;\n',
      'core/dispatcher.mjs': 'export const core = true;\n',
      'tests/mock.test.mjs': 'test fixture\n',
      'docs/overview.md': 'documentation text\n',
      'modules/trm/cargo.lock': 'version = 3\n',
      'modules/trm/oversized.bin': 'x'.repeat(55 * 1024)
    };
    for (const [rel, content] of Object.entries(files)) {
      const fullPath = path.join(localRoot, rel);
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, content);
    }

    const local = triageAndDigest({
      repositoryUrl: 'https://github.com/sorensencc-dotcom/kb-sync',
      localRoot,
      targetModules: ['modules/trm/*', 'core/*'],
      excludePatterns: 'tests/*,docs/*,*.lock,*.png,*.html',
      maxFileSizeKb: 50,
      authToken: 'ghp_ephemeral_token_do_not_persist'
    });

    const content = local.data.ingestionDigest.content;
    assert.match(content, /queryExpander/);
    assert.match(content, /astGrounding/);
    assert.match(content, /gapTriageEngine/);
    assert.match(content, /core/);
    assert.equal(content.includes('test fixture'), false);
    assert.equal(content.includes('documentation text'), false);
    assert.equal(content.includes('version = 3'), false);
    assert.equal(JSON.stringify(local).includes('ghp_ephemeral_token_do_not_persist'), false);
    assert.equal(local.data.ingestionDigest.security.credentialsDiscarded, true);

    const reasons = new Map(local.data.ingestionDigest.pruned.map((p) => [p.path, p.reason]));
    assert.equal(reasons.get('tests/mock.test.mjs'), 'tests/*');
    assert.equal(reasons.get('docs/overview.md'), 'docs/*');
    assert.equal(reasons.get('modules/trm/cargo.lock'), '*.lock');
    assert.equal(reasons.get('modules/trm/oversized.bin'), 'size');
  } finally {
    fs.rmSync(localRoot, { recursive: true, force: true });
  }
});
