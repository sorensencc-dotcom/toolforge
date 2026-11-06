#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process'; // noqa: SEC-AUDITOR - read-only local git diff inspection with argument array, no shell
import { fileURLToPath } from 'node:url';

export const WEIGHTS = {
  impact: 2.0,
  verification: 2.0,
  rollbackCost: 1.5,
  errorDetection: 1.0,
  alignment: 1.0
};

export const TOTAL_WEIGHT = Object.values(WEIGHTS).reduce((sum, w) => sum + w, 0); // 7.5

export const SENSITIVE_PATTERNS = [
  { type: 'auth', regex: /(?:^|[/\-_])(auth|login|session|oauth|token)[^/\\]*$/i },
  { type: 'permissions', regex: /(?:^|[/\-_])(permission|rbac|containment|gate)[^/\\]*$/i },
  { type: 'secrets', regex: /(?:^|[/\-_])(secret|credential|api[-_]?key|\.env)[^/\\]*$/i },
  { type: 'migrations', regex: /(?:^|[/\\])(migration|migrations)[/\\]/i },
  { type: 'dependencies', regex: /(package(-lock)?\.json|yarn\.lock|pnpm-lock\.yaml)$/i },
  { type: 'infra', regex: /(docker-compose|\.github\/workflows|Dockerfile)[^/\\]*$/i }
];

export function detectSensitivePaths(files = []) {
  const matches = [];
  for (const file of files) {
    for (const pat of SENSITIVE_PATTERNS) {
      if (pat.regex.test(file)) {
        matches.push({ file, type: pat.type });
        break;
      }
    }
  }
  return matches;
}

export function computeRiskScore(points) {
  const weightedSum =
    points.impact * WEIGHTS.impact +
    points.verification * WEIGHTS.verification +
    points.rollbackCost * WEIGHTS.rollbackCost +
    points.errorDetection * WEIGHTS.errorDetection +
    points.alignment * WEIGHTS.alignment;

  const score = Math.round((weightedSum / TOTAL_WEIGHT) * 100) / 100;
  let risk = 'low';
  if (score >= 2.25) risk = 'high';
  else if (score >= 1.5) risk = 'medium';

  return { score, risk };
}

export function formatRiskReport(risk, breakdown) {
  const lines = [`**Merge risk: ${risk}**\n`];

  // 1. Alignment
  lines.push(`**Alignment:** ${breakdown.alignment.verdict}`);
  for (const gap of breakdown.alignment.gaps) lines.push(`- ${gap}`);
  lines.push('');

  // 2. Impact
  lines.push(`**Impact:** ${breakdown.impact.verdict}`);
  for (const gap of breakdown.impact.gaps) lines.push(`- ${gap}`);
  lines.push('');

  // 3. Verification
  lines.push(`**Verification:** ${breakdown.verification.verdict}`);
  for (const gap of breakdown.verification.gaps) lines.push(`- ${gap}`);
  lines.push('');

  // 4. Rollback cost
  lines.push(`**Rollback cost:** ${breakdown.rollbackCost.verdict}`);
  for (const gap of breakdown.rollbackCost.gaps) lines.push(`- ${gap}`);
  lines.push('');

  // 5. Error detection
  lines.push(`**Error detection:** ${breakdown.errorDetection.verdict}`);
  for (const gap of breakdown.errorDetection.gaps) lines.push(`- ${gap}`);

  return lines.join('\n');
}

export function evaluateMergeRisk(options = {}) {
  const manual = options.manualScores || {};
  const files = options.files || [];
  const card = options.cardData || null;

  // Points mapping: 3 = warning, 2 = caution, 1 = good
  const points = {
    alignment: 1,
    impact: 1,
    verification: 1,
    rollbackCost: 1,
    errorDetection: 1
  };

  const breakdown = {
    alignment: { verdict: 'good ✅', points: 1, gaps: [] },
    impact: { verdict: 'small ✅', points: 1, gaps: [] },
    verification: { verdict: 'good ✅', points: 1, gaps: [] },
    rollbackCost: { verdict: 'low ✅', points: 1, gaps: [] },
    errorDetection: { verdict: 'good ✅', points: 1, gaps: [] }
  };

  // 1. Alignment
  if (manual.alignment) {
    if (manual.alignment === 'poor') { points.alignment = 3; breakdown.alignment.verdict = 'poor ⚠️'; }
    else if (manual.alignment === 'decent') { points.alignment = 2; breakdown.alignment.verdict = 'decent 👀'; }
    else { points.alignment = 1; breakdown.alignment.verdict = 'good ✅'; }
    if (options.alignmentGaps) breakdown.alignment.gaps = options.alignmentGaps;
  } else if (card && card.enrichment && card.enrichment.tier === 'HUMAN_INTERVENTION') {
    points.alignment = 2;
    breakdown.alignment.verdict = 'decent 👀';
    breakdown.alignment.gaps.push('Card requires human intervention or manual specification alignment.');
  }

  // 2. Impact
  if (manual.impact) {
    if (manual.impact === 'large') { points.impact = 3; breakdown.impact.verdict = 'large ⚠️'; }
    else if (manual.impact === 'medium') { points.impact = 2; breakdown.impact.verdict = 'medium 👀'; }
    else { points.impact = 1; breakdown.impact.verdict = 'small ✅'; }
    if (options.impactGaps) breakdown.impact.gaps = options.impactGaps;
  } else {
    const sensitive = detectSensitivePaths(files);
    if (sensitive.length > 0) {
      points.impact = 3;
      breakdown.impact.verdict = 'large ⚠️';
      for (const m of sensitive) {
        breakdown.impact.gaps.push(`Touches sensitive ${m.type} pathway: \`${m.file}\``);
      }
    } else if (files.length > 15) {
      points.impact = 2;
      breakdown.impact.verdict = 'medium 👀';
      breakdown.impact.gaps.push(`Broad surface area: ${files.length} changed files.`);
    } else {
      breakdown.impact.gaps.push('Changes isolated to scoped component or documentation.');
    }
  }

  // 3. Verification
  if (manual.verification) {
    if (manual.verification === 'poor') { points.verification = 3; breakdown.verification.verdict = 'poor ⚠️'; }
    else if (manual.verification === 'decent') { points.verification = 2; breakdown.verification.verdict = 'decent 👀'; }
    else { points.verification = 1; breakdown.verification.verdict = 'good ✅'; }
    if (options.verificationGaps) breakdown.verification.gaps = options.verificationGaps;
  } else {
    const hasTests = files.some(f => /test|\.test\.|_test\./i.test(f));
    if (files.length > 0 && !hasTests) {
      points.verification = 3;
      breakdown.verification.verdict = 'poor ⚠️';
      breakdown.verification.gaps.push('No unit or integration tests detected in changeset.');
    } else {
      breakdown.verification.gaps.push('Automated tests provided for core touched behavior.');
    }
  }

  // 4. Rollback cost
  if (manual.rollbackCost) {
    if (manual.rollbackCost === 'high') { points.rollbackCost = 3; breakdown.rollbackCost.verdict = 'high ⚠️'; }
    else if (manual.rollbackCost === 'medium') { points.rollbackCost = 2; breakdown.rollbackCost.verdict = 'medium 👀'; }
    else { points.rollbackCost = 1; breakdown.rollbackCost.verdict = 'low ✅'; }
    if (options.rollbackGaps) breakdown.rollbackCost.gaps = options.rollbackGaps;
  } else {
    const hasSchemaChanges = files.some(f => /migration|schema|sql/i.test(f));
    if (hasSchemaChanges) {
      points.rollbackCost = 2;
      breakdown.rollbackCost.verdict = 'medium 👀';
      breakdown.rollbackCost.gaps.push('Schema or data migration changes present potential one-way door dependencies.');
    } else {
      breakdown.rollbackCost.gaps.push('Two-way door: clean revert supported via standard git revert.');
    }
  }

  // 5. Error detection
  if (manual.errorDetection) {
    if (manual.errorDetection === 'poor') { points.errorDetection = 3; breakdown.errorDetection.verdict = 'poor ⚠️'; }
    else if (manual.errorDetection === 'decent') { points.errorDetection = 2; breakdown.errorDetection.verdict = 'decent 👀'; }
    else { points.errorDetection = 1; breakdown.errorDetection.verdict = 'good ✅'; }
    if (options.errorDetectionGaps) breakdown.errorDetection.gaps = options.errorDetectionGaps;
  } else {
    breakdown.errorDetection.gaps.push('Standard logging and structured assertions intact.');
  }

  const { score, risk } = computeRiskScore(points);
  const formatted = formatRiskReport(risk, breakdown);

  return {
    status: 'success',
    risk,
    score,
    points,
    breakdown,
    formatted
  };
}

export function evaluateGitDiffRisk(repoDir, baseRef = 'origin/main', headRef = 'HEAD') {
  try {
    const nameStatus = execFileSync('git', ['diff', '--name-only', `${baseRef}...${headRef}`], { // noqa: SEC-AUDITOR - fixed read-only git diff command
      cwd: repoDir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    });
    const files = nameStatus.split('\n').map(s => s.trim()).filter(Boolean);
    return evaluateMergeRisk({ files });
  } catch (err) {
    return {
      status: 'error',
      code: 'GIT_DIFF_FAILED',
      error: err.message
    };
  }
}

async function main() {
  const args = process.argv.slice(2);
  let baseRef = 'origin/main';
  let headRef = 'HEAD';
  let repoDir = process.cwd();

  for (const arg of args) {
    if (arg.startsWith('--base=')) baseRef = arg.slice(7);
    else if (arg.startsWith('--head=')) headRef = arg.slice(7);
    else if (arg.startsWith('--repo=')) repoDir = arg.slice(7);
  }

  const result = evaluateGitDiffRisk(repoDir, baseRef, headRef);
  if (result.status === 'error') {
    console.error(`[merge-risk] Error: ${result.error}`);
    process.exit(1);
  }

  console.log(result.formatted);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main();
}
