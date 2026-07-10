export type AuditVerdict = 'RED' | 'YELLOW' | 'GREEN';

export interface AuditAssessment {
  verdict: AuditVerdict;
  blockers: string[];
  risks: string[];
  ready: string[];
  nextSteps: Array<{ action: string; owner?: string; deadline?: string }>;
  reasoning: string;
}

export function assessVerdict(
  coreAnswers: Record<number, string>,
  extendedAnswers: Record<number, string>
): AuditAssessment {
  const blockers: string[] = [];
  const risks: string[] = [];
  const ready: string[] = [];
  const nextSteps: Array<{ action: string; owner?: string; deadline?: string }> = [];

  // Check for missing/empty answers — audit cannot proceed without user input
  const coreEmpty = Object.values(coreAnswers).filter((a) => !a || a === '[skipped]' || a === '').length;
  const extendedEmpty = Object.values(extendedAnswers).filter((a) => !a || a === '[skipped]' || a === '').length;

  if (coreEmpty === 4) {
    // All core answers missing — audit incomplete
    blockers.push(
      'Audit incomplete: All 4 core questions skipped or unanswered. MUST: Complete blind-spot assessment before deployment.'
    );
  } else if (coreEmpty > 0) {
    // Some core answers missing
    risks.push(
      `Audit incomplete: ${coreEmpty}/4 core questions unanswered. Should complete for full assessment.`
    );
  }

  // Assess Core Questions
  const q1 = coreAnswers[1] || '';
  const q2 = coreAnswers[2] || '';
  const q3 = coreAnswers[3] || '';
  const q4 = coreAnswers[4] || '';

  // Q1: Confidence gaps that indicate unverified code
  if (
    q1.toLowerCase().includes('never ran') ||
    q1.toLowerCase().includes('untested') ||
    q1.toLowerCase().includes('unexecuted')
  ) {
    blockers.push(
      `Confidence gap: ${q1.substring(0, 100)}... Code unverified at runtime. MUST: Execute tests before deployment.`
    );
    nextSteps.push({
      action: 'Run end-to-end or integration test',
      deadline: 'Before canary'
    });
  }

  // Q2: Missing context that blocks verification
  if (
    q2.toLowerCase().includes('unknown') ||
    q2.toLowerCase().includes('untracked') ||
    q2.toLowerCase().includes('dirty')
  ) {
    if (q2.toLowerCase().includes('deployment') || q2.toLowerCase().includes('state')) {
      blockers.push(`Missing context: ${q2.substring(0, 100)}... State unknown. MUST: Verify before proceeding.`);
      nextSteps.push({
        action: 'Run diagnostics (git status, submodule check, etc)',
        deadline: 'Immediately'
      });
    } else {
      risks.push(`Missing context: ${q2.substring(0, 80)}... May impact decision.`);
    }
  }

  // Q3: Load-bearing assumptions
  if (q3.length > 0) {
    risks.push(
      `Key assumption: ${q3.substring(0, 80)}... If false, recommendation changes. SHOULD: Verify assumption.`
    );
    nextSteps.push({
      action: 'Verify assumption in code/docs/requirements',
      deadline: 'Before rollout'
    });
  }

  // Q4: Verification checklist — any unchecked MUST items blocks
  const mustItems = extractMustItems(q4);
  if (mustItems.unchecked.length > 0) {
    mustItems.unchecked.forEach((item) => {
      blockers.push(`Verification gap: ${item} (marked MUST but not done)`);
    });
  }
  if (mustItems.checked.length > 0) {
    mustItems.checked.forEach((item) => {
      ready.push(`✓ Verification: ${item}`);
    });
  }

  // Assess Extended Fields
  const q5 = extendedAnswers[5] || '';
  const q6 = extendedAnswers[6] || '';
  const q7 = extendedAnswers[7] || '';
  const q8 = extendedAnswers[8] || '';
  const q9 = extendedAnswers[9] || '';
  const q10 = extendedAnswers[10] || '';
  const q11 = extendedAnswers[11] || '';
  const q12 = extendedAnswers[12] || '';

  // Q5: Dependencies
  if (
    q5.toLowerCase().includes('down') ||
    q5.toLowerCase().includes('offline') ||
    q5.toLowerCase().includes('unavailable')
  ) {
    blockers.push(`Dependencies: Critical system down or unavailable. ${q5.substring(0, 80)}`);
  } else if (q5.length > 0 && !q5.toLowerCase().includes('online')) {
    risks.push(`Dependencies: Monitor status before rollout. ${q5.substring(0, 80)}`);
  }

  // Q6: Regression — backwards compat issues
  if (q6.toLowerCase().includes('breaking') || q6.toLowerCase().includes('not tested')) {
    risks.push(`Regression: Backwards compatibility at risk. ${q6.substring(0, 80)}`);
    nextSteps.push({
      action: 'Run regression test suite or canary with 1% traffic first',
      deadline: 'Before 10% rollout'
    });
  }

  // Q7: Documentation
  if (q7.toLowerCase().includes('mismatch') || q7.toLowerCase().includes('outdated')) {
    risks.push(
      `Documentation: Guides may not match code. Operators may follow incorrect procedures. ${q7.substring(0, 60)}`
    );
    nextSteps.push({
      action: 'Have operator review docs against actual code',
      deadline: 'Before training'
    });
  }

  // Q8: Rollback
  if (
    q8.toLowerCase().includes('not tested') ||
    q8.toLowerCase().includes('no backup') ||
    q8.toLowerCase().includes('unknown')
  ) {
    risks.push(`Rollback: Recovery not fully tested. ${q8.substring(0, 80)}`);
    nextSteps.push({
      action: 'Test rollback procedure (dry-run)',
      deadline: 'Before canary'
    });
  }

  // Q9: Known unknowns
  if (
    q9.toLowerCase().includes('untested') &&
    (q9.toLowerCase().includes('load') ||
      q9.toLowerCase().includes('scale') ||
      q9.toLowerCase().includes('concurrency'))
  ) {
    risks.push(`Known unknowns: Performance/scale not validated. ${q9.substring(0, 80)}`);
    nextSteps.push({
      action: 'Load test or canary with gradual ramp-up',
      deadline: 'Day 1 of deployment'
    });
  }

  // Q10: Stakeholder alignment
  if (
    q10.toLowerCase().includes('not aware') ||
    q10.toLowerCase().includes('not approved') ||
    q10.toLowerCase().includes('not signed')
  ) {
    blockers.push(`Stakeholder alignment: Decision-maker not signed off. ${q10.substring(0, 80)}`);
    nextSteps.push({
      action: 'Get explicit approval from decision-maker',
      deadline: 'Before deployment'
    });
  }

  // Q11: Data integrity
  if (
    q11.toLowerCase().includes('not tested') ||
    q11.toLowerCase().includes('no backup') ||
    q11.toLowerCase().includes('corruption')
  ) {
    if (q11.toLowerCase().includes('corruption') || q11.toLowerCase().includes('loss')) {
      blockers.push(`Data integrity: Corruption or loss risk. ${q11.substring(0, 80)}`);
    } else {
      risks.push(`Data integrity: Dry-run migration not completed. ${q11.substring(0, 80)}`);
    }
    nextSteps.push({
      action: 'Run migration dry-run on staging with production-scale data',
      deadline: 'Before production'
    });
  }

  // Q12: Security
  if (
    q12.toLowerCase().includes('exposed') ||
    q12.toLowerCase().includes('vulnerable') ||
    q12.toLowerCase().includes('not reviewed')
  ) {
    if (q12.toLowerCase().includes('secrets') || q12.toLowerCase().includes('exposed')) {
      blockers.push(
        `Security: Credentials or secrets exposed. ${q12.substring(0, 80)} CRITICAL: Do not deploy.`
      );
    } else {
      risks.push(`Security: Code not reviewed. ${q12.substring(0, 80)}`);
      nextSteps.push({
        action: 'Have security team review auth/authz/input validation',
        deadline: 'Before canary'
      });
    }
  }

  // Determine overall verdict
  let verdict: AuditVerdict = 'GREEN';
  let reasoning = 'All checks pass or acceptable risk.';

  if (blockers.length > 0) {
    verdict = 'RED';
    reasoning = `Critical blockers must be resolved: ${blockers.length} blocker(s) identified.`;
  } else if (risks.length > 0) {
    verdict = 'YELLOW';
    reasoning = `Important risks identified: ${risks.length} risk(s). Escalate for decision.`;
  } else {
    reasoning = 'All verification steps complete. Ready to proceed.';
  }

  return {
    verdict,
    blockers,
    risks,
    ready,
    nextSteps,
    reasoning
  };
}

function extractMustItems(q4: string): { checked: string[]; unchecked: string[] } {
  const lines = q4.split('\n');
  const checked: string[] = [];
  const unchecked: string[] = [];

  lines.forEach((line) => {
    if (line.includes('MUST:')) {
      const item = line.replace(/.*MUST:\s*/, '').trim();
      if (line.includes('✓') || line.includes('✔') || line.toLowerCase().includes('done')) {
        checked.push(item);
      } else if (line.includes('✗') || line.toLowerCase().includes('not done')) {
        unchecked.push(item);
      }
    }
  });

  return { checked, unchecked };
}
