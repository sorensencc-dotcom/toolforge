import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { validateHookChain, EXPECTED_HOOKS } from '../src/index.js';

function writeHook(content) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hook-validator-'));
  const hookPath = path.join(dir, 'pre-commit');
  fs.writeFileSync(hookPath, content);
  return hookPath;
}

test('Hook Validator', async (t) => {
  await t.test('returns GREEN when all hooks present, in order, with merged-shim marker', () => {
    const hookPath = writeHook(`#!/bin/sh\n# merged-shim\n${EXPECTED_HOOKS.join('\n')}\n`);
    const result = validateHookChain(hookPath);
    assert.strictEqual(result.verdict, 'GREEN');
  });

  await t.test('returns RED when hook file is missing', () => {
    const result = validateHookChain(path.join(os.tmpdir(), 'does-not-exist-pre-commit'));
    assert.strictEqual(result.verdict, 'RED');
    assert.ok(result.checks.some((c) => c.name === 'Shim Completeness' && c.level === 'error'));
  });

  await t.test('returns RED when a hook is missing from the chain', () => {
    const hookPath = writeHook(`#!/bin/sh\n# merged-shim\ngovernance-check\nsecret-scan\n`);
    const result = validateHookChain(hookPath);
    assert.strictEqual(result.verdict, 'RED');
    const completeness = result.checks.find((c) => c.name === 'Shim Completeness');
    assert.match(completeness.message, /retro-schema-check/);
    assert.match(completeness.message, /roadmap-validator/);
  });

  await t.test('warns (does not fail) when hooks are present but out of sequence', () => {
    const reversed = [...EXPECTED_HOOKS].reverse();
    const hookPath = writeHook(`#!/bin/sh\n# merged-shim\n${reversed.join('\n')}\n`);
    const result = validateHookChain(hookPath);
    assert.strictEqual(result.verdict, 'YELLOW');
    assert.ok(result.checks.some((c) => c.name === 'Sequencing' && c.level === 'warning'));
  });

  await t.test('warns when merged-shim marker is absent (cannot confirm installer race is resolved)', () => {
    const hookPath = writeHook(`#!/bin/sh\n${EXPECTED_HOOKS.join('\n')}\n`);
    const result = validateHookChain(hookPath);
    assert.strictEqual(result.verdict, 'YELLOW');
    assert.ok(result.checks.some((c) => c.name === 'Order-Independence' && c.level === 'warning'));
  });
});
