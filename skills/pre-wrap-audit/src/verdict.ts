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
  const q3Lower = q3.toLowerCase();
  if (
    q3.length > 0 &&
    !q3Lower.startsWith('no ') &&
    !q3Lower.includes('no assumption') &&
    !q3Lower.includes('no load-bearing') &&
    !q3Lower.includes('none')
  ) {
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
  const q5Lower = q5.toLowerCase();
  if (
    (q5Lower.includes('down') || q5Lower.includes('offline') || q5Lower.includes('unavailable')) &&
    !q5Lower.includes('no ') &&
    !q5Lower.includes('all online')
  ) {
    blockers.push(`Dependencies: Critical system down or unavailable. ${q5.substring(0, 80)}`);
  } else if (q5.length > 0 && !q5Lower.includes('online') && !q5Lower.includes('ok')) {
    risks.push(`Dependencies: Monitor status before rollout. ${q5.substring(0, 80)}`);
  }

  // Q6: Regression — backwards compat issues
  const q6Lower = q6.toLowerCase();
  if (
    (q6Lower.includes('breaking') || q6Lower.includes('not tested')) &&
    !q6Lower.includes('no breaking') &&
    !q6Lower.includes('compat tested')
  ) {
    risks.push(`Regression: Backwards compatibility at risk. ${q6.substring(0, 80)}`);
    nextSteps.push({
      action: 'Run regression test suite or canary with 1% traffic first',
      deadline: 'Before 10% rollout'
    });
  }

  // Q7: Documentation
  const q7Lower = q7.toLowerCase();
  if (
    (q7Lower.includes('mismatch') || q7Lower.includes('outdated')) &&
    !q7Lower.includes('no mismatch')
  ) {
    risks.push(
      `Documentation: Guides may not match code. Operators may follow incorrect procedures. ${q7.substring(0, 60)}`
    );
    nextSteps.push({
      action: 'Have operator review docs against actual code',
      deadline: 'Before training'
    });
  }

  // Q8: Rollback
  const q8Lower = q8.toLowerCase();
  if (
    (q8Lower.includes('not tested') || q8Lower.includes('no backup') || q8Lower.includes('unknown')) &&
    !q8Lower.includes('fully tested') &&
    !q8Lower.includes('rollback tested') &&
    !q8Lower.includes('rollback ok') &&
    !q8Lower.includes('procedure tested')
  ) {
    risks.push(`Rollback: Recovery not fully tested. ${q8.substring(0, 80)}`);
    nextSteps.push({
      action: 'Test rollback procedure (dry-run)',
      deadline: 'Before canary'
    });
  }

  // Q9: Known unknowns
  const q9Lower = q9.toLowerCase();
  if (
    (q9Lower.includes('untested') || q9Lower.includes('not validated') || q9Lower.includes('unknown') || q9Lower.includes('load')) &&
    !q9Lower.startsWith('no ') &&
    !q9Lower.includes('no unknown') &&
    !q9Lower.includes('no edge') &&
    !q9Lower.includes('load tested') &&
    (q9Lower.includes('load') ||
      q9Lower.includes('scale') ||
      q9Lower.includes('concurrency') ||
      q9Lower.includes('performance') ||
      q9Lower.includes('edge case'))
  ) {
    risks.push(`Unknowns: Performance/scale not validated. ${q9.substring(0, 80)}`);
    nextSteps.push({
      action: 'Load test or canary with gradual ramp-up',
      deadline: 'Day 1 of deployment'
    });
  }

  // Q10: Stakeholder alignment
  const q10Lower = q10.toLowerCase();
  if (
    q10Lower.includes('not aware') ||
    q10Lower.includes('not approved') ||
    q10Lower.includes('not signed')
  ) {
    blockers.push(`Stakeholder alignment: Decision-maker not signed off. ${q10.substring(0, 80)}`);
    nextSteps.push({
      action: 'Get explicit approval from decision-maker',
      deadline: 'Before deployment'
    });
  }

  // Q11: Data integrity
  const q11Lower = q11.toLowerCase();
  if (
    (q11Lower.includes('not tested') ||
      q11Lower.includes('no backup') ||
      q11Lower.includes('corruption') ||
      q11Lower.includes('not completed') ||
      q11Lower.includes('not dry-run') ||
      q11Lower.includes('not run')) &&
    !q11Lower.startsWith('no ') &&
    !q11Lower.includes('no data') &&
    !q11Lower.includes('migration tested')
  ) {
    if (q11Lower.includes('corruption') || q11Lower.includes('loss')) {
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
  const q12Lower = q12.toLowerCase();
  if (
    (q12Lower.includes('exposed') ||
      q12Lower.includes('vulnerable') ||
      q12Lower.includes('not reviewed')) &&
    !q12Lower.includes('no security') &&
    !q12Lower.includes('no vulnerabilities')
  ) {
    if (q12Lower.includes('secrets') || q12Lower.includes('exposed')) {
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
    reasoning = 'All checks pass. Ready to proceed.';
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
  const parts = q4.split(/(?=[✓✔✗]|\bMUST:)/g);
  const checked: string[] = [];
  const unchecked: string[] = [];

  parts.forEach((part) => {
    if (part.includes('MUST:')) {
      const item = part.replace(/.*MUST:\s*/, '').replace(/[✓✔✗].*/, '').trim();
      if (part.includes('✗') || part.toLowerCase().includes('not done') || part.toLowerCase().includes('not run')) {
        unchecked.push(item);
      } else if (
        part.includes('✓') ||
        part.includes('✔') ||
        part.toLowerCase().includes('done') ||
        part.toLowerCase().includes('passed') ||
        part.toLowerCase().includes('approved') ||
        part.toLowerCase().includes('verified')
      ) {
        checked.push(item);
      }
    }
  });

  return { checked, unchecked };
}
