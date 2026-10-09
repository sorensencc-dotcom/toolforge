import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import assert from 'node:assert/strict';

const repositoryRoot = path.resolve(import.meta.dirname, '../../../..');
const validator = path.join(repositoryRoot, 'utilities/skill-doc-validator.ps1');

for (const skill of ['benchmark-mistral-large-chonk', 'lean-proof-verification-harness']) {
  test(`${skill} passes documentation validation and fails without its guide link`, (t) => {
    const skillRoot = path.join(repositoryRoot, 'skills', skill);
    const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-guide-regression-'));
    t.after(() => fs.rmSync(fixture, { recursive: true, force: true }));
    for (const name of ['README.md', 'SKILL.md']) {
      fs.copyFileSync(path.join(skillRoot, name), path.join(fixture, name));
    }
    const original = fs.readFileSync(path.join(fixture, 'SKILL.md'), 'utf8');
    const link = original.match(/\[Skill Operator Guide\]\(([^)]+)\)/);
    assert.ok(link, 'repaired skill must link to the guide');
    assert.ok(fs.existsSync(path.resolve(skillRoot, link[1])), 'guide link must resolve');

    const validate = () => spawnSync('pwsh', ['-NoProfile', '-NonInteractive', '-File', validator, '-Path', fixture], {
      encoding: 'utf8', timeout: 15_000,
    });
    const passing = validate();
    assert.equal(passing.status, 0, passing.stdout + passing.stderr);

    fs.writeFileSync(path.join(fixture, 'SKILL.md'), original.replace(/^.*skill-operator-guide.*\r?\n/gm, ''));
    const failing = validate();
    assert.equal(failing.status, 1, failing.stdout + failing.stderr);
    assert.match(failing.stdout, /Neither README.md nor SKILL.md reference Skill Operator Guide/);
  });
}
