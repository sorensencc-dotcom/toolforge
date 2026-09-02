import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { validateFile, validateFiles } from '../src/index.js';

function writeRetro(data) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'retro-schema-'));
  const file = path.join(dir, 'retro.json');
  fs.writeFileSync(file, JSON.stringify(data));
  return file;
}

const validRetro = {
  date: '2026-08-23',
  type: 'weekly',
  metrics: { unit_scale: 80, active_days: 5, commits_authored: 12, issues_closed: 3 },
  sections: { wins: ['shipped x'], blockers: [], next: ['ship y'] },
  notes: 'all good',
};

test('validateFile', async (t) => {
  await t.test('returns ok for a fully valid v1.0 retro', () => {
    const result = validateFile(writeRetro(validRetro));
    assert.strictEqual(result.ok, true);
    assert.deepStrictEqual(result.violations, []);
  });

  await t.test('errors on missing required top-level field', () => {
    const { notes, ...rest } = validRetro;
    const result = validateFile(writeRetro(rest));
    assert.strictEqual(result.ok, false);
    assert.ok(result.violations.some((v) => v.field === 'notes' && /Missing required field/.test(v.message)));
  });

  await t.test('errors on type mismatch (unit_scale as string)', () => {
    const bad = { ...validRetro, metrics: { ...validRetro.metrics, unit_scale: '80' } };
    const result = validateFile(writeRetro(bad));
    assert.strictEqual(result.ok, false);
    assert.ok(result.violations.some((v) => v.field === 'metrics.unit_scale' && /must be number/.test(v.message)));
  });

  await t.test('errors on out-of-range active_days', () => {
    const bad = { ...validRetro, metrics: { ...validRetro.metrics, active_days: 9 } };
    const result = validateFile(writeRetro(bad));
    assert.strictEqual(result.ok, false);
    assert.ok(result.violations.some((v) => v.field === 'metrics.active_days' && /<= 7/.test(v.message)));
  });

  await t.test('errors on out-of-range unit_scale (negative)', () => {
    const bad = { ...validRetro, metrics: { ...validRetro.metrics, unit_scale: -5 } };
    const result = validateFile(writeRetro(bad));
    assert.strictEqual(result.ok, false);
    assert.ok(result.violations.some((v) => v.field === 'metrics.unit_scale' && />= 0/.test(v.message)));
  });

  await t.test('flags unknown top-level field as a warning, not an error', () => {
    const withExtra = { ...validRetro, mood: 'great' };
    const result = validateFile(writeRetro(withExtra));
    const unknown = result.violations.find((v) => v.field === 'mood');
    assert.ok(unknown);
    assert.strictEqual(unknown.level, 'warning');
    assert.strictEqual(result.ok, true);
  });

  await t.test('errors on sections field with wrong type', () => {
    const bad = { ...validRetro, sections: { ...validRetro.sections, wins: 'shipped x' } };
    const result = validateFile(writeRetro(bad));
    assert.strictEqual(result.ok, false);
    assert.ok(result.violations.some((v) => v.field === 'sections.wins' && /must be array/.test(v.message)));
  });

  await t.test('reports invalid JSON', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'retro-schema-'));
    const file = path.join(dir, 'bad.json');
    fs.writeFileSync(file, '{ not json');
    const result = validateFile(file);
    assert.strictEqual(result.ok, false);
    assert.ok(result.violations.some((v) => v.field === 'json'));
  });

  await t.test('reports missing file', () => {
    const result = validateFile(path.join(os.tmpdir(), 'nope-does-not-exist.json'));
    assert.strictEqual(result.ok, false);
    assert.ok(result.violations.some((v) => v.field === 'file'));
  });
});

test('validateFiles', async (t) => {
  await t.test('GREEN when all files valid', () => {
    const output = validateFiles([writeRetro(validRetro), writeRetro(validRetro)]);
    assert.strictEqual(output.verdict, 'GREEN');
  });

  await t.test('RED when any file has an error-level violation', () => {
    const { date, ...rest } = validRetro;
    const output = validateFiles([writeRetro(validRetro), writeRetro(rest)]);
    assert.strictEqual(output.verdict, 'RED');
  });

  await t.test('YELLOW when only warning-level violations exist', () => {
    const output = validateFiles([writeRetro({ ...validRetro, mood: 'great' })]);
    assert.strictEqual(output.verdict, 'YELLOW');
  });
});
