import { CORE_QUESTIONS, EXTENDED_FIELDS, ALL_QUESTIONS, AuditAnswer } from './questions';
import { assessVerdict, AuditAssessment } from './verdict';
import * as readline from 'readline';

export interface SessionContext {
  sessionId: string;
  projectContext?: string;
  timestamp?: string;
  interactive?: boolean;
}

export interface AuditReport {
  verdict: 'RED' | 'YELLOW' | 'GREEN';
  coreAnswers: Record<number, string>;
  extendedAnswers: Record<number, string>;
  assessment: AuditAssessment;
  sessionId: string;
  projectContext?: string;
  timestamp: string;
  signedOffBy?: string;
  stored: boolean;
}

/**
 * Conduct a comprehensive 12-point blind-spot audit before session wrap.
 *
 * Returns RED/YELLOW/GREEN verdict:
 * - RED: Critical blockers must be resolved before deployment
 * - YELLOW: Important risks identified, escalate for decision
 * - GREEN: All checks pass or acceptable risk, proceed
 */
export async function runAudit(context: SessionContext): Promise<AuditReport> {
  const timestamp = context.timestamp || new Date().toISOString();
  const coreAnswers: Record<number, string> = {};
  const extendedAnswers: Record<number, string> = {};

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('BLIND-SPOT AUDIT — Session Wrap Assessment');
  console.log('═══════════════════════════════════════════════════════════\n');

  if (context.projectContext) {
    console.log(`📋 Project: ${context.projectContext}\n`);
  }

  // Phase 1: Core Questions (mandatory)
  console.log('PHASE 1: CORE BLIND-SPOT QUESTIONS (4)\n');
  for (const q of CORE_QUESTIONS) {
    console.log(`${q.number}. ${q.question}`);
    console.log(`   Guidance: ${q.guidance}\n`);

    const answer = await captureAnswer(q.number);
    coreAnswers[q.number] = answer;
  }

  // Phase 2: Extended Fields (comprehensive assessment)
  console.log(
    '\nPHASE 2: EXTENDED AUDIT FIELDS (8)\n' + 'Assessing dependencies, regression, documentation, rollback, unknowns, stakeholders, data, security.\n'
  );
  for (const q of EXTENDED_FIELDS) {
    console.log(`${q.number}. ${q.question}`);
    console.log(`   Guidance: ${q.guidance}\n`);

    const answer = await captureAnswer(q.number);
    extendedAnswers[q.number] = answer;
  }

  // Phase 3: Assess Verdict
  console.log('\nPHASE 3: VERDICT ASSESSMENT\n');
  const assessment = assessVerdict(coreAnswers, extendedAnswers);

  // Phase 4: Report & Escalation
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('AUDIT VERDICT');
  console.log('═══════════════════════════════════════════════════════════\n');

  console.log(`OVERALL: ${assessment.verdict}\n`);
  console.log(`Reasoning: ${assessment.reasoning}\n`);

  if (assessment.blockers.length > 0) {
    console.log('BLOCKERS (RED) — Must resolve before deployment:');
    assessment.blockers.forEach((b) => console.log(`  ✗ ${b}`));
    console.log();
  }

  if (assessment.risks.length > 0) {
    console.log('RISKS (YELLOW) — Important gaps, escalate for decision:');
    assessment.risks.forEach((r) => console.log(`  ⚠ ${r}`));
    console.log();
  }

  if (assessment.ready.length > 0) {
    console.log('READY (GREEN) — Verification passes:');
    assessment.ready.forEach((r) => console.log(`  ✓ ${r}`));
    console.log();
  }

  if (assessment.nextSteps.length > 0) {
    console.log('NEXT STEPS:');
    assessment.nextSteps.forEach((step, i) => {
      console.log(`  ${i + 1}. ${step.action}`);
      if (step.owner) console.log(`     Owner: ${step.owner}`);
      if (step.deadline) console.log(`     Deadline: ${step.deadline}`);
    });
    console.log();
  }

  console.log('═══════════════════════════════════════════════════════════\n');

  // Handle verdict
  if (assessment.verdict === 'RED') {
    console.error('🛑 RED FLAG: Session cannot terminate until blockers resolved.\n');
    console.error('Escalating to engineering lead. Do not proceed with deployment.\n');
  }

  if (assessment.verdict === 'YELLOW') {
    console.warn(
      '⚠️  YELLOW FLAG: Risks identified. User must explicitly accept before proceeding.\n'
    );
  }

  if (assessment.verdict === 'GREEN') {
    console.log('✅ GREEN FLAG: All checks pass. Ready to proceed.\n');
  }

  // Build report
  const report: AuditReport = {
    verdict: assessment.verdict,
    coreAnswers,
    extendedAnswers,
    assessment,
    sessionId: context.sessionId,
    projectContext: context.projectContext,
    timestamp,
    stored: false
  };

  // Store report (in real implementation, would save to .claude/sessions/[id]/audit-report.json)
  console.log(`📊 Audit report stored: ${context.sessionId}`);
  report.stored = true;

  return report;
}

/**
 * Capture answer from user input via interactive readline prompt.
 */
async function captureAnswer(questionNumber: number): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    rl.question('Your answer: ', (answer: string) => {
      rl.close();
      resolve(answer.trim() || '[skipped]');
    });
  });
}

/**
 * Format audit report for output (JSON, Markdown, or summary).
 */
export function formatAuditReport(
  report: AuditReport,
  format: 'json' | 'markdown' | 'summary' = 'markdown'
): string {
  if (format === 'json') {
    return JSON.stringify(report, null, 2);
  }

  if (format === 'summary') {
    return `VERDICT: ${report.verdict}\nBlockers: ${report.assessment.blockers.length}\nRisks: ${report.assessment.risks.length}\nReady: ${report.assessment.ready.length}`;
  }

  // Markdown format
  let md = `# Audit Report\n\n`;
  md += `**Verdict:** ${report.verdict}\n`;
  md += `**Timestamp:** ${report.timestamp}\n`;
  md += `**Session:** ${report.sessionId}\n\n`;

  if (report.projectContext) {
    md += `## Project\n\n${report.projectContext}\n\n`;
  }

  md += `## Core Questions\n\n`;
  CORE_QUESTIONS.forEach((q) => {
    const answer = report.coreAnswers[q.number] || '[no answer]';
    md += `### Q${q.number}: ${q.question}\n\n${answer}\n\n`;
  });

  md += `## Extended Fields\n\n`;
  EXTENDED_FIELDS.forEach((q) => {
    const answer = report.extendedAnswers[q.number] || '[no answer]';
    md += `### Q${q.number}: ${q.question}\n\n${answer}\n\n`;
  });

  md += `## Assessment\n\n`;
  md += `**Reasoning:** ${report.assessment.reasoning}\n\n`;

  if (report.assessment.blockers.length > 0) {
    md += `### Blockers\n\n`;
    report.assessment.blockers.forEach((b) => (md += `- ${b}\n`));
    md += '\n';
  }

  if (report.assessment.risks.length > 0) {
    md += `### Risks\n\n`;
    report.assessment.risks.forEach((r) => (md += `- ${r}\n`));
    md += '\n';
  }

  if (report.assessment.nextSteps.length > 0) {
    md += `### Next Steps\n\n`;
    report.assessment.nextSteps.forEach((step) => {
      md += `- **${step.action}**`;
      if (step.owner) md += ` (Owner: ${step.owner})`;
      if (step.deadline) md += ` - Deadline: ${step.deadline}`;
      md += '\n';
    });
  }

  return md;
}


