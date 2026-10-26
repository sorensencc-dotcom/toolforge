import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const script = readFileSync(resolve('scripts/with-ollama-paused.ps1'), 'utf8');

test('with-ollama-paused stops the serve launcher, serve, and runners before the command', () => {
  assert.match(script, /ollama\\\.exe\.\*serve/);
  assert.match(script, /Get-Process ollama, 'ollama app', llama-server/);
  assert.ok(script.indexOf('Stop-OllamaAll\n') < script.indexOf('& pwsh -NoProfile -Command $Command'));
});

test('with-ollama-paused restores ollama in finally and propagates the exit code', () => {
  const finallyAt = script.indexOf('finally {');
  assert.notEqual(finallyAt, -1);
  assert.ok(script.indexOf("Start-Process -FilePath $ollama -ArgumentList 'serve'") > finallyAt);
  assert.match(script, /\$code = \$LASTEXITCODE/);
  assert.match(script, /exit \$code/);
});
