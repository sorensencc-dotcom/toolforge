import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import assert from 'node:assert/strict';

const repositoryRoot = path.resolve(import.meta.dirname, '../../../..');
const wrapperPath = path.join(repositoryRoot, 'scripts/graft-deep.ps1');

function runWrapper(argumentsText, { offline = false, graftExit = 0, apiKey = '' } = {}) {
  const probe = offline
    ? 'throw "offline fixture"'
    : 'return @{ models = @(@{ name = "qwen2.5:7b" }) }';
  const command = `
    function Invoke-RestMethod { ${probe} }
    function graft {
      Write-Output ('GRAFT_ARGS:' + (ConvertTo-Json -Compress -InputObject $args))
      $global:LASTEXITCODE = ${graftExit}
    }
    & '${wrapperPath.replaceAll("'", "''")}' -RepoPath '${repositoryRoot.replaceAll("'", "''")}' ${argumentsText}
    exit $LASTEXITCODE
  `;
  return spawnSync('pwsh', ['-NoProfile', '-NonInteractive', '-Command', command], {
    cwd: repositoryRoot,
    encoding: 'utf8',
    timeout: 15_000,
    env: { ...process.env, OPENROUTER_API_KEY: apiKey, ANTHROPIC_API_KEY: '' },
  });
}

test('Graft CI builds the ignored graph before checking it with a pinned CLI', () => {
  const workflow = fs.readFileSync(path.join(repositoryRoot, '.github/workflows/governance.yml'), 'utf8');
  const job = workflow.split('\n  graft-freshness:')[1];
  assert.ok(job, 'Graft job must exist');
  assert.match(job, /node-version: '22'/);
  assert.match(job, /npm install -g @nanonets\/graft@0\.21\.1/);
  assert.match(job, /graft-freshness\.test\.js/);
  assert.match(job, /run: graft build\s+[\s\S]*run: graft check/);
  assert.doesNotMatch(job, /continue-on-error|\|\| true|--deep/);
});

test('deep wrapper routes local builds and preserves execution flags', () => {
  const result = runWrapper('-Tier tier0 -Concurrency 3 -NoReuse');
  assert.equal(result.status, 0, result.stderr || result.error?.message);
  const args = JSON.parse(result.stdout.match(/GRAFT_ARGS:(.+)/)[1]);
  assert.deepEqual(args, [
    'build', '--deep', '--provider', 'openai', '--base-url', 'http://127.0.0.1:11434/v1',
    '--api-key', 'ollama', '--model', 'qwen2.5:7b', '--concurrency', '3', '--allow-partial', '--no-reuse',
  ]);
});

test('deep wrapper dry run masks cloud credentials and never invokes Graft', () => {
  const apiKey = ['fixture', 'routing', 'credential'].join('-');
  const result = runWrapper('-Tier tier1 -Model fixture/model -DryRun', { offline: true, apiKey });
  assert.equal(result.status, 0, result.stderr || result.error?.message);
  assert.match(result.stdout, /fixture\/model/);
  assert.doesNotMatch(result.stdout + result.stderr, new RegExp(apiKey));
  assert.doesNotMatch(result.stdout, /GRAFT_ARGS:/);
});

test('deep wrapper propagates a failed Graft build exit code', () => {
  const result = runWrapper('-Tier tier0', { graftExit: 23 });
  assert.equal(result.status, 23, result.stderr || result.error?.message);
});

test('automatic routing selects local Ollama without interpolating the dollar amount', () => {
  const result = runWrapper('-Tier auto -DryRun');
  assert.equal(result.status, 0, result.stderr || result.error?.message);
  assert.match(result.stdout, /Offline Substrate \$0\.00/);
  assert.match(result.stdout, /Rate: \$0\.00\/1M tokens/);
  assert.match(result.stdout, /--base-url http:\/\/127\.0\.0\.1:11434\/v1/);
  assert.doesNotMatch(result.stdout, /GRAFT_ARGS:/);
});
