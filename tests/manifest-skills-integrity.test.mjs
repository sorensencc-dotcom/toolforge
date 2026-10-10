import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const REPO_ROOT = process.cwd();
const MANIFEST_PATH = path.join(REPO_ROOT, 'manifest.json');

test('manifest.json maintains skill registry invariants', () => {
  assert.ok(fs.existsSync(MANIFEST_PATH), 'manifest.json must exist');
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));

  assert.ok(Array.isArray(manifest.skills), 'manifest.skills must be an array');
  assert.equal(manifest.skills.length, 60, 'manifest.skills must contain exactly 60 skills');

  const names = new Set();
  for (const skill of manifest.skills) {
    assert.ok(skill.name, 'skill must have name');
    assert.ok(skill.id, `skill ${skill.name} must have id`);
    assert.ok(skill.category, `skill ${skill.name} must have category`);
    assert.ok(skill.status, `skill ${skill.name} must have status`);
    assert.ok(skill.entrypoint, `skill ${skill.name} must have entrypoint`);
    assert.ok(!names.has(skill.name), `duplicate skill name: ${skill.name}`);
    names.add(skill.name);

    // Verify directory exists for repo-local skills
    const skillDir = path.join(REPO_ROOT, 'skills', skill.name);
    if (fs.existsSync(skillDir)) {
      const skillMd = path.join(skillDir, 'SKILL.md');
      assert.ok(fs.existsSync(skillMd), `SKILL.md must exist in ${skillDir}`);
    }
  }

  // Key skill invariants from PR #110 and origin/main
  assert.ok(names.has('vane-research'), 'vane-research skill must be registered');
  assert.ok(names.has('usagecheck'), 'usagecheck skill must be registered');
  assert.ok(names.has('active-work-overview'), 'active-work-overview skill must be registered');
  assert.equal(names.has('sigil-consult'), false, 'deprecated sigil-consult must be pruned');
});
