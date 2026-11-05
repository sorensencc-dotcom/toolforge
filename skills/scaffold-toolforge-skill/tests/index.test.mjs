import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  validateSkillId, renderSkillJson, manifestEntry, insertManifestEntry,
  bumpPinnedCount, checkDocLimits, scaffoldSkill,
} from '../src/index.mjs';

test('validateSkillId accepts kebab-case and rejects the rest', () => {
  assert.equal(validateSkillId('run-tests-safe').ok, true);
  for (const bad of ['Run-Tests', 'a', 'two--hyphens', '-lead', 'trail-', '_TEMPLATE', '1abc', 'has space', 'x'.repeat(49), 42]) {
    assert.equal(validateSkillId(bad).ok, false, String(bad));
  }
});

test('validateSkillId rejects duplicates', () => {
  const r = validateSkillId('wrap-session', ['wrap-session']);
  assert.equal(r.ok, false);
  assert.match(r.reason, /already exists/);
});

test('renderSkillJson is valid JSON with id, entrypoint, and test command', () => {
  const j = JSON.parse(renderSkillJson({ id: 'my-skill', description: 'D', keywords: ['k'] }));
  assert.equal(j.id, 'my-skill');
  assert.equal(j.name, 'My Skill');
  assert.equal(j.entrypoint, 'src/index.mjs');
  assert.match(j.commands.test, /skills\/my-skill\/tests\/index\.test\.mjs/);
});

test('manifestEntry is a candidate with the expected key order', () => {
  const e = manifestEntry({ id: 'my-skill', description: 'D', keywords: ['k'], date: '2026-10-24' });
  assert.equal(e.status, 'candidate');
  assert.equal(e.path, 'skills/my-skill');
  const j = JSON.parse(renderSkillJson({ id: 'my-skill', description: 'D', keywords: ['k'] }));
  assert.deepEqual(j.tags, e.tags);
  assert.equal(e.timestamps.created, '2026-10-24T00:00:00Z');
  assert.deepEqual(Object.keys(e).slice(0, 3), ['version', 'description', 'timestamps']);
});

test('insertManifestEntry appends valid JSON and leaves the tail untouched', () => {
  const text = '{\n  "skills": [\n    {\n      "id": "a"\n    }\n  ],\n  "summary": {\n    "total": 1\n  }\n}\n';
  const out = insertManifestEntry(text, { id: 'b', tags: [] });
  const parsed = JSON.parse(out);
  assert.deepEqual(parsed.skills.map((s) => s.id), ['a', 'b']);
  assert.ok(out.endsWith('  "summary": {\n    "total": 1\n  }\n}\n'));
  assert.throws(() => insertManifestEntry('{}', {}), /end of skills array/);
});

test('bumpPinnedCount rewrites both numbers', () => {
  const src = "assert.equal(manifest.skills.length, 66, 'manifest.skills must contain exactly 66 skills');";
  assert.equal(bumpPinnedCount(src, 67), "assert.equal(manifest.skills.length, 67, 'manifest.skills must contain exactly 67 skills');");
  assert.throws(() => bumpPinnedCount('nothing', 1), /not found/);
});

test('checkDocLimits enforces README < 100 and SKILL.md < 150', () => {
  const lines = (n) => 'x\n'.repeat(n);
  assert.deepEqual(checkDocLimits({ readme: lines(99), skillMd: lines(149) }), []);
  assert.equal(checkDocLimits({ readme: lines(100), skillMd: lines(150) }).length, 2);
});

test('scaffoldSkill writes the structure, adds USAGE only for >3 steps, never overwrites', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'scaf-'));
  const files = scaffoldSkill(root, { id: 'demo-skill', description: 'Demo.', steps: 5 });
  assert.deepEqual(files, ['README.md', 'SKILL.md', 'docs/USAGE.md', 'skill.json', 'src/index.mjs', 'tests/index.test.mjs']);
  assert.throws(() => scaffoldSkill(root, { id: 'demo-skill', description: 'Demo.' }), /already exists/);
  const small = scaffoldSkill(root, { id: 'tiny-skill', description: 'Tiny.', steps: 2 });
  assert.ok(!small.includes('docs/USAGE.md'));
  fs.rmSync(root, { recursive: true });
});
