import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { runTrmTriage } from '../skills/trm-triage/src/index.mjs';

test('trm-triage skill runner processes task cards', async () => {
  const result = await runTrmTriage({ dryRun: true });
  assert.ok(result, 'Expected result object');
  assert.equal(typeof result.totalCards, 'number');
  assert.ok(Array.isArray(result.triagedCards), 'Expected array of triaged cards');
  assert.ok(result.triagedCards.length > 0, 'Expected at least one card in pending/archive');

  // Verify manifest and skill metadata exist
  const skillJsonPath = path.resolve('skills/trm-triage/skill.json');
  const skillMdPath = path.resolve('skills/trm-triage/SKILL.md');
  const readmeMdPath = path.resolve('skills/trm-triage/README.md');

  assert.ok(fs.existsSync(skillJsonPath), 'Missing skill.json');
  assert.ok(fs.existsSync(skillMdPath), 'Missing SKILL.md');
  assert.ok(fs.existsSync(readmeMdPath), 'Missing README.md');

  // Verify SKILL.md line limit (< 150 lines per Skill Operator Guide)
  const skillMdLines = fs.readFileSync(skillMdPath, 'utf8').split(/\r?\n/).length;
  assert.ok(skillMdLines < 150, `SKILL.md too long: ${skillMdLines} lines`);

  // Verify README.md line limit (< 100 lines per Skill Operator Guide)
  const readmeLines = fs.readFileSync(readmeMdPath, 'utf8').split(/\r?\n/).length;
  assert.ok(readmeLines < 100, `README.md too long: ${readmeLines} lines`);

  // Verify registration in root manifest.json
  const manifest = JSON.parse(fs.readFileSync(path.resolve('manifest.json'), 'utf8'));
  const registered = manifest.skills.find(s => s.id === 'trm-triage' || s.name === 'trm-triage');
  assert.ok(registered, 'Missing trm-triage registration in manifest.json');
});
