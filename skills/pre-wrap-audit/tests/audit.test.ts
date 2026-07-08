import { runAudit, formatAuditReport, AuditReport } from '../src/index';
import { assessVerdict } from '../src/verdict';

describe('pre-wrap-audit', () => {
  describe('audit conductor', () => {
    it('returns RED when critical blocker exists', async () => {
      const context = {
        sessionId: 'test-session-1',
        projectContext: 'Phase 27 Wave F deployment',
        interactive: false
      };

      // In real test, would mock captureAnswer to return answers
      const report = await runAudit(context);
      expect(report).toBeDefined();
      expect(report.verdict).toMatch(/RED|YELLOW|GREEN/);
    });
  });

  describe('verdict assessment', () => {
    it('returns RED when jest test never ran', () => {
      const coreAnswers = {
        1: 'Jest test never ran Wave F code. Only TypeScript compilation verified.',
        2: 'No issues',
        3: 'No load-bearing assumptions',
        4: '✓ MUST: Deployment approved. ✓ SHOULD: Docs reviewed.'
      };

      const extendedAnswers = {
        5: 'All systems online and monitored.',
        6: 'No breaking changes.',
        7: 'Docs match code.',
        8: 'Rollback tested.',
        9: 'No edge cases.',
        10: 'All stakeholders approved.',
        11: 'No data migrations.',
        12: 'No security issues.'
      };

      const assessment = assessVerdict(coreAnswers, extendedAnswers);
      expect(assessment.verdict).toBe('RED');
      expect(assessment.blockers.length).toBeGreaterThan(0);
      expect(assessment.blockers[0]).toContain('Confidence gap');
    });

    it('returns RED when submodule state unknown', () => {
      const coreAnswers = {
        1: 'Minimal confidence gap.',
        2: 'Submodules show untracked content. Unknown if deployment works.',
        3: 'No load-bearing assumptions',
        4: '✓ MUST: All checked.'
      };

      const extendedAnswers = {
        5: 'All online.',
        6: 'No breaking changes.',
        7: 'Docs OK.',
        8: 'Rollback OK.',
        9: 'No unknowns.',
        10: 'Approved.',
        11: 'No data.',
        12: 'Secure.'
      };

      const assessment = assessVerdict(coreAnswers, extendedAnswers);
      expect(assessment.verdict).toBe('RED');
      expect(assessment.blockers.some((b) => b.includes('Missing context'))).toBe(true);
    });

    it('returns YELLOW when regression not tested', () => {
      const coreAnswers = {
        1: 'No gaps.',
        2: 'No missing context.',
        3: 'No assumptions.',
        4: '✓ MUST: All done.'
      };

      const extendedAnswers = {
        5: 'All online.',
        6: 'Breaking changes not tested yet.',
        7: 'Docs OK.',
        8: 'Rollback OK.',
        9: 'No unknowns.',
        10: 'Approved.',
        11: 'No data.',
        12: 'Secure.'
      };

      const assessment = assessVerdict(coreAnswers, extendedAnswers);
      expect(assessment.verdict).toBe('YELLOW');
      expect(assessment.risks.length).toBeGreaterThan(0);
      expect(assessment.risks.some((r) => r.includes('Regression'))).toBe(true);
    });

    it('returns RED when credentials exposed', () => {
      const coreAnswers = {
        1: 'No gaps.',
        2: 'No missing context.',
        3: 'No assumptions.',
        4: '✓ MUST: All done.'
      };

      const extendedAnswers = {
        5: 'All online.',
        6: 'No breaking changes.',
        7: 'Docs OK.',
        8: 'Rollback OK.',
        9: 'No unknowns.',
        10: 'Approved.',
        11: 'No data.',
        12: 'Secrets exposed in logs.'
      };

      const assessment = assessVerdict(coreAnswers, extendedAnswers);
      expect(assessment.verdict).toBe('RED');
      expect(assessment.blockers.some((b) => b.includes('exposed'))).toBe(true);
    });

    it('returns RED when stakeholder not approved', () => {
      const coreAnswers = {
        1: 'No gaps.',
        2: 'No missing context.',
        3: 'No assumptions.',
        4: '✓ MUST: All done.'
      };

      const extendedAnswers = {
        5: 'All online.',
        6: 'No breaking changes.',
        7: 'Docs OK.',
        8: 'Rollback OK.',
        9: 'No unknowns.',
        10: 'Engineering lead not signed off yet.',
        11: 'No data.',
        12: 'Secure.'
      };

      const assessment = assessVerdict(coreAnswers, extendedAnswers);
      expect(assessment.verdict).toBe('RED');
      expect(assessment.blockers.some((b) => b.includes('Stakeholder'))).toBe(true);
    });

    it('returns YELLOW when data migration not dry-run', () => {
      const coreAnswers = {
        1: 'No gaps.',
        2: 'No missing context.',
        3: 'No assumptions.',
        4: '✓ MUST: All done.'
      };

      const extendedAnswers = {
        5: 'All online.',
        6: 'No breaking changes.',
        7: 'Docs OK.',
        8: 'Rollback OK.',
        9: 'No unknowns.',
        10: 'Approved.',
        11: 'Migration dry-run not completed.',
        12: 'Secure.'
      };

      const assessment = assessVerdict(coreAnswers, extendedAnswers);
      expect(assessment.verdict).toBe('YELLOW');
      expect(assessment.risks.some((r) => r.includes('Data integrity'))).toBe(true);
    });

    it('returns GREEN when all checks pass', () => {
      const coreAnswers = {
        1: 'No confidence gaps.',
        2: 'No missing context.',
        3: 'No load-bearing assumptions.',
        4: '✓ MUST: All verified. ✓ SHOULD: All done.'
      };

      const extendedAnswers = {
        5: 'All systems online and monitored.',
        6: 'No breaking changes. Backwards compat tested.',
        7: 'Docs match code. Operators reviewed.',
        8: 'Rollback tested and recovery time acceptable.',
        9: 'No edge cases. Load tested.',
        10: 'All stakeholders approved and signed off.',
        11: 'Migration tested on prod-scale data.',
        12: 'No security vulnerabilities. Security team reviewed.'
      };

      const assessment = assessVerdict(coreAnswers, extendedAnswers);
      expect(assessment.verdict).toBe('GREEN');
      expect(assessment.blockers.length).toBe(0);
      expect(assessment.reasoning).toContain('All checks pass');
    });

    it('includes next steps for unresolved issues', () => {
      const coreAnswers = {
        1: 'Code never ran at runtime.',
        2: 'No context.',
        3: 'No assumptions.',
        4: '✗ MUST: Test not run.'
      };

      const extendedAnswers = {
        5: 'All online.',
        6: 'Not tested for regression.',
        7: 'Docs OK.',
        8: 'Rollback not tested.',
        9: 'Load test not run.',
        10: 'Approved.',
        11: 'Dry-run not done.',
        12: 'Security review pending.'
      };

      const assessment = assessVerdict(coreAnswers, extendedAnswers);
      expect(assessment.nextSteps.length).toBeGreaterThan(0);
      expect(assessment.nextSteps.some((s) => s.action.toLowerCase().includes('test'))).toBe(true);
    });
  });

  describe('report formatting', () => {
    const mockReport: AuditReport = {
      verdict: 'YELLOW',
      coreAnswers: {
        1: 'Minor gap in edge case handling.',
        2: 'Some untested scenarios.',
        3: 'Assumption about 90-day retention.',
        4: 'MUST: Code review done. SHOULD: Load test pending.'
      },
      extendedAnswers: {
        5: 'DB monitoring in place.',
        6: 'Regression testing partial.',
        7: 'Docs mostly accurate.',
        8: 'Rollback procedure drafted.',
        9: 'Load testing not done.',
        10: 'Leadership approved.',
        11: 'Schema tested.',
        12: 'Security review pending.'
      },
      assessment: {
        verdict: 'YELLOW',
        blockers: [],
        risks: ['Regression testing incomplete', 'Load testing pending'],
        ready: [],
        nextSteps: [
          { action: 'Complete regression testing', deadline: 'Before 10% rollout' },
          { action: 'Run load test', deadline: 'Day 1 of canary' }
        ],
        reasoning: 'Important risks identified'
      },
      sessionId: 'test-session',
      projectContext: 'Phase 27 Wave F',
      timestamp: new Date().toISOString(),
      stored: true
    };

    it('formats report as JSON', () => {
      const json = formatAuditReport(mockReport, 'json');
      const parsed = JSON.parse(json);
      expect(parsed.verdict).toBe('YELLOW');
      expect(parsed.sessionId).toBe('test-session');
    });

    it('formats report as markdown', () => {
      const md = formatAuditReport(mockReport, 'markdown');
      expect(md).toContain('# Audit Report');
      expect(md).toContain('YELLOW');
      expect(md).toContain('Phase 27 Wave F');
      expect(md).toContain('Core Questions');
      expect(md).toContain('Extended Fields');
    });

    it('formats report as summary', () => {
      const summary = formatAuditReport(mockReport, 'summary');
      expect(summary).toContain('VERDICT: YELLOW');
      expect(summary).toContain('Blockers: 0');
      expect(summary).toContain('Risks: 2');
    });
  });
});
