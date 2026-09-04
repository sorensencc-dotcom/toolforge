import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mergeManifests } from '../scripts/install-plan.mjs';

describe('Toolforge Idempotent Installer Suite', () => {
  it('merges new skills while preserving all existing tools untouched', () => {
    const existing = {
      manifestVersion: '1.0.0',
      skills: [
        { skillId: 'ashfall', name: 'Ashfall Engine', version: '1.0.0', owner: 'soren' },
        { skillId: 'analyze-token-burn', name: 'Analyze Token Burn', version: '1.0.0', owner: 'soren' }
      ]
    };
    const incoming = {
      manifestVersion: '1.0.0',
      skills: [
        { skillId: 'trm-tinyfish-triage', name: 'TinyFish Triage', version: '1.0.0' }
      ]
    };
    const merged = mergeManifests(existing, incoming);
    assert.equal(merged.skills.length, 3);
    assert.ok(merged.skills.some(s => s.skillId === 'ashfall'));
    assert.ok(merged.skills.some(s => s.skillId === 'analyze-token-burn'));
    assert.ok(merged.skills.some(s => s.skillId === 'trm-tinyfish-triage'));
  });

  it('runs idempotently (second merge produces identical output)', () => {
    const initial = {
      manifestVersion: '1.0.0',
      skills: [{ skillId: 'ashfall', name: 'Ashfall Engine', version: '1.0.0' }]
    };
    const incoming = {
      manifestVersion: '1.0.0',
      skills: [{ skillId: 'trm-tinyfish-triage', name: 'TinyFish Triage', version: '1.0.0' }]
    };
    const firstRun = mergeManifests(initial, incoming);
    const secondRun = mergeManifests(firstRun, incoming);
    assert.deepEqual(firstRun, secondRun);
  });

  it('fails if changing an existing skillId without force flag', () => {
    const existing = {
      manifestVersion: '1.0.0',
      skills: [{ skillId: 'trm-tinyfish-triage', name: 'TinyFish Triage', version: '1.0.0', customLock: true }]
    };
    const conflicting = {
      manifestVersion: '1.0.0',
      skills: [{ skillId: 'trm-tinyfish-triage', name: 'Renamed Triage', version: '1.0.0', customLock: false }]
    };
    assert.throws(() => {
      mergeManifests(existing, conflicting, { force: false });
    }, /Skill configuration conflict/);
  });
});
