import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { RULES } from '../scripts/lint-script-claims.mjs';

describe('YouTube Script Claim Linter Suite', () => {
  it('loads rule definitions correctly', () => {
    assert.ok(Array.isArray(RULES), 'Rules must be an array');
    assert.ok(RULES.length > 0, 'Must have at least one rule');
    assert.ok(RULES.some(r => r.id === 'HIST-01-B17-WILLOW-RUN'));
  });

  it('detects historical violation on ungrounded claim', () => {
    const violationText = 'Ford assembled B-17 Flying Fortresses at Willow Run.';
    const b17Rule = RULES.find(r => r.id === 'HIST-01-B17-WILLOW-RUN');
    assert.ok(b17Rule.pattern.test(violationText), 'Must match ungrounded B-17 at Willow Run claim');
  });

  it('respects exemption pattern when debunking folklore', () => {
    const debunkText = 'It is a common myth that Willow Run built B-17 bombers; zero were produced there.';
    const b17Rule = RULES.find(r => r.id === 'HIST-01-B17-WILLOW-RUN');
    assert.ok(b17Rule.exemption.test(debunkText), 'Must match exemption pattern for debunking context');
  });
});
