import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeRiskScore,
  detectSensitivePaths,
  evaluateMergeRisk,
  WEIGHTS,
  TOTAL_WEIGHT
} from '../src/index.mjs';

test('WEIGHTS sum to 7.5 and match Pocock specification', () => {
  assert.equal(WEIGHTS.impact, 2.0);
  assert.equal(WEIGHTS.verification, 2.0);
  assert.equal(WEIGHTS.rollbackCost, 1.5);
  assert.equal(WEIGHTS.errorDetection, 1.0);
  assert.equal(WEIGHTS.alignment, 1.0);
  assert.equal(TOTAL_WEIGHT, 7.5);
});

test('computeRiskScore calculates exact weighted threshold tiers', () => {
  // All low (1s)
  const low = computeRiskScore({ impact: 1, verification: 1, rollbackCost: 1, errorDetection: 1, alignment: 1 });
  assert.equal(low.score, 1.0);
  assert.equal(low.risk, 'low');

  // Exact medium threshold (1.5)
  // E.g. Impact=2, Verification=2, Rollback=1, Error=1, Alignment=1 -> (4 + 4 + 1.5 + 1 + 1)/7.5 = 11.5/7.5 = 1.53
  const med = computeRiskScore({ impact: 2, verification: 2, rollbackCost: 1, errorDetection: 1, alignment: 1 });
  assert.ok(med.score >= 1.5 && med.score < 2.25);
  assert.equal(med.risk, 'medium');

  // High threshold (>= 2.25)
  // E.g. Impact=3, Verification=3, Rollback=2, Error=1, Alignment=2 -> (6 + 6 + 3 + 1 + 2)/7.5 = 18/7.5 = 2.4
  const high = computeRiskScore({ impact: 3, verification: 3, rollbackCost: 2, errorDetection: 1, alignment: 2 });
  assert.ok(high.score >= 2.25);
  assert.equal(high.risk, 'high');
});

test('detectSensitivePaths detects security, credential, and migration boundaries', () => {
  const files = [
    'src/api/auth.js',
    'scripts/lib/security-containment-gate.mjs',
    'config/secret.json',
    'migrations/001_create_tables.sql',
    'package.json',
    'src/views/button.js'
  ];

  const sensitive = detectSensitivePaths(files);
  const types = sensitive.map(s => s.type);

  assert.ok(types.includes('auth'));
  assert.ok(types.includes('permissions'));
  assert.ok(types.includes('secrets'));
  assert.ok(types.includes('migrations'));
  assert.ok(types.includes('dependencies'));
  assert.equal(sensitive.some(s => s.file === 'src/views/button.js'), false);
});

test('evaluateMergeRisk outputs compliant markdown formatting', () => {
  const res = evaluateMergeRisk({
    manualScores: {
      alignment: 'good',
      impact: 'large',
      verification: 'decent',
      rollbackCost: 'low',
      errorDetection: 'good'
    },
    impactGaps: ['Touches security containment gate']
  });

  assert.equal(res.status, 'success');
  assert.match(res.formatted, /^\*\*Merge risk: (low|medium|high)\*\*/);
  assert.match(res.formatted, /\*\*Alignment:\*\* good ✅/);
  assert.match(res.formatted, /\*\*Impact:\*\* large ⚠️/);
  assert.match(res.formatted, /\*\*Verification:\*\* decent 👀/);
  assert.match(res.formatted, /\*\*Rollback cost:\*\* low ✅/);
  assert.match(res.formatted, /\*\*Error detection:\*\* good ✅/);
});

test('evaluateMergeRisk heuristic flags missing tests and sensitive areas', () => {
  const res = evaluateMergeRisk({
    files: ['src/auth/login.js', 'src/api/server.js']
  });

  // Sensitive auth -> impact 3
  assert.equal(res.points.impact, 3);
  // No test files -> verification 3
  assert.equal(res.points.verification, 3);
  // Rollback cost 1
  assert.equal(res.points.rollbackCost, 1);

  // Score: (3*2 + 3*2 + 1*1.5 + 1*1 + 1*1)/7.5 = 15.5/7.5 = 2.07 -> medium
  assert.equal(res.risk, 'medium');
  assert.ok(res.breakdown.impact.gaps.length > 0);
  assert.ok(res.breakdown.verification.gaps.length > 0);
});
