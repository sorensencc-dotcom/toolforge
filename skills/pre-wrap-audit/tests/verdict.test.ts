import { assessVerdict, AuditVerdict } from '../src/verdict';

describe('AuditVerdict', () => {
  describe('RED flag logic', () => {
    it('returns RED when code unexecuted at runtime', () => {
      const coreAnswers = {
        1: 'Jest test never ran. Code unverified at runtime.',
        2: 'No context gaps.',
        3: 'No assumptions.',
        4: 'All checks done.'
      };
      const extendedAnswers = {
        5: 'All online.',
        6: 'No regression.',
        7: 'Docs OK.',
        8: 'Rollback OK.',
        9: 'No unknowns.',
        10: 'Approved.',
        11: 'No data.',
        12: 'Secure.'
      };

      const result = assessVerdict(coreAnswers, extendedAnswers);
      expect(result.verdict).toBe('RED');
    });

    it('returns RED when critical state unknown', () => {
      const coreAnswers = {
        1: 'No gaps.',
        2: 'Submodule state unknown. Deployment will copy wrong state.',
        3: 'No assumptions.',
        4: 'All done.'
      };
      const extendedAnswers = {
        5: 'Online.',
        6: 'OK.',
        7: 'OK.',
        8: 'OK.',
        9: 'OK.',
        10: 'Approved.',
        11: 'No data.',
        12: 'Secure.'
      };

      const result = assessVerdict(coreAnswers, extendedAnswers);
      expect(result.verdict).toBe('RED');
    });

    it('returns RED when stakeholder not approved', () => {
      const coreAnswers = {
        1: 'No gaps.',
        2: 'No context gaps.',
        3: 'No assumptions.',
        4: 'Done.'
      };
      const extendedAnswers = {
        5: 'Online.',
        6: 'OK.',
        7: 'OK.',
        8: 'OK.',
        9: 'OK.',
        10: 'Decision-maker not signed off yet.',
        11: 'No data.',
        12: 'Secure.'
      };

      const result = assessVerdict(coreAnswers, extendedAnswers);
      expect(result.verdict).toBe('RED');
    });

    it('returns RED when credentials exposed', () => {
      const coreAnswers = {
        1: 'No gaps.',
        2: 'No context.',
        3: 'No assumptions.',
        4: 'Done.'
      };
      const extendedAnswers = {
        5: 'Online.',
        6: 'OK.',
        7: 'OK.',
        8: 'OK.',
        9: 'OK.',
        10: 'Approved.',
        11: 'No data.',
        12: 'Secrets exposed in environment variables.'
      };

      const result = assessVerdict(coreAnswers, extendedAnswers);
      expect(result.verdict).toBe('RED');
    });

    it('RED verdict blocks deployment', () => {
      const coreAnswers = {
        1: 'Untested runtime behavior.',
        2: 'No context.',
        3: 'No assumptions.',
        4: 'Done.'
      };
      const extendedAnswers = {
        5: 'Online.',
        6: 'OK.',
        7: 'OK.',
        8: 'OK.',
        9: 'OK.',
        10: 'Approved.',
        11: 'No data.',
        12: 'Secure.'
      };

      const result = assessVerdict(coreAnswers, extendedAnswers);
      expect(result.verdict).toBe('RED');
      expect(result.blockers.length).toBeGreaterThan(0);
      expect(result.reasoning).toContain('Critical blockers');
    });
  });

  describe('YELLOW flag logic', () => {
    it('returns YELLOW when regression not tested', () => {
      const coreAnswers = {
        1: 'No gaps.',
        2: 'No context gaps.',
        3: 'No assumptions.',
        4: 'All done.'
      };
      const extendedAnswers = {
        5: 'Online.',
        6: 'Backwards compatibility not tested.',
        7: 'OK.',
        8: 'OK.',
        9: 'OK.',
        10: 'Approved.',
        11: 'No data.',
        12: 'Secure.'
      };

      const result = assessVerdict(coreAnswers, extendedAnswers);
      expect(result.verdict).toBe('YELLOW');
      expect(result.risks.some((r) => r.includes('Regression'))).toBe(true);
    });

    it('returns YELLOW when load testing incomplete', () => {
      const coreAnswers = {
        1: 'No gaps.',
        2: 'No context.',
        3: 'No assumptions.',
        4: 'Done.'
      };
      const extendedAnswers = {
        5: 'Online.',
        6: 'OK.',
        7: 'OK.',
        8: 'OK.',
        9: 'Performance under load not validated.',
        10: 'Approved.',
        11: 'No data.',
        12: 'Secure.'
      };

      const result = assessVerdict(coreAnswers, extendedAnswers);
      expect(result.verdict).toBe('YELLOW');
      expect(result.risks.some((r) => r.includes('Unknown'))).toBe(true);
    });

    it('YELLOW verdict requires escalation', () => {
      const coreAnswers = {
        1: 'No gaps.',
        2: 'No context.',
        3: 'Assumption about 90-day retention.',
        4: 'Done.'
      };
      const extendedAnswers = {
        5: 'Online.',
        6: 'OK.',
        7: 'OK.',
        8: 'Rollback not fully tested.',
        9: 'OK.',
        10: 'Approved.',
        11: 'No data.',
        12: 'Secure.'
      };

      const result = assessVerdict(coreAnswers, extendedAnswers);
      expect(result.verdict).toBe('YELLOW');
      expect(result.nextSteps.length).toBeGreaterThan(0);
      expect(result.reasoning).toContain('risks');
    });
  });

  describe('GREEN flag logic', () => {
    it('returns GREEN when all checks pass', () => {
      const coreAnswers = {
        1: 'No gaps.',
        2: 'No context gaps.',
        3: 'No load-bearing assumptions.',
        4: '✓ MUST: All done. ✓ SHOULD: All verified.'
      };
      const extendedAnswers = {
        5: 'All systems online and monitored.',
        6: 'No breaking changes. Backwards compat tested.',
        7: 'Docs match code.',
        8: 'Rollback fully tested.',
        9: 'No unknown edge cases.',
        10: 'All stakeholders signed off.',
        11: 'No data migrations.',
        12: 'No security vulnerabilities.'
      };

      const result = assessVerdict(coreAnswers, extendedAnswers);
      expect(result.verdict).toBe('GREEN');
      expect(result.blockers.length).toBe(0);
      expect(result.risks.length).toBe(0);
    });

    it('GREEN verdict permits deployment', () => {
      const coreAnswers = {
        1: 'No gaps.',
        2: 'No context.',
        3: 'No assumptions.',
        4: 'All verified.'
      };
      const extendedAnswers = {
        5: 'All online and healthy.',
        6: 'Tested and no breaking changes.',
        7: 'Accurate and reviewed.',
        8: 'Procedure tested.',
        9: 'No unknowns.',
        10: 'Approved.',
        11: 'No data work.',
        12: 'Secure.'
      };

      const result = assessVerdict(coreAnswers, extendedAnswers);
      expect(result.verdict).toBe('GREEN');
      expect(result.reasoning).toContain('All checks pass');
    });
  });

  describe('MUST item extraction', () => {
    it('identifies checked MUST items', () => {
      const coreAnswers = {
        1: 'No gaps.',
        2: 'No context.',
        3: 'No assumptions.',
        4: '✓ MUST: Unit tests passed. ✓ MUST: E2E tests passed.'
      };
      const extendedAnswers = {
        5: 'OK.',
        6: 'OK.',
        7: 'OK.',
        8: 'OK.',
        9: 'OK.',
        10: 'Approved.',
        11: 'OK.',
        12: 'OK.'
      };

      const result = assessVerdict(coreAnswers, extendedAnswers);
      expect(result.ready.some((r) => r.includes('✓ Verification'))).toBe(true);
    });

    it('flags unchecked MUST items', () => {
      const coreAnswers = {
        1: 'No gaps.',
        2: 'No context.',
        3: 'No assumptions.',
        4: '✗ MUST: Integration test not run. ✓ MUST: Unit test passed.'
      };
      const extendedAnswers = {
        5: 'OK.',
        6: 'OK.',
        7: 'OK.',
        8: 'OK.',
        9: 'OK.',
        10: 'Approved.',
        11: 'OK.',
        12: 'OK.'
      };

      const result = assessVerdict(coreAnswers, extendedAnswers);
      expect(result.verdict).toBe('RED');
      expect(result.blockers.some((b) => b.includes('Integration test'))).toBe(true);
    });
  });

  describe('assessment completeness', () => {
    it('includes all required fields', () => {
      const coreAnswers = {
        1: 'Test.',
        2: 'Test.',
        3: 'Test.',
        4: 'Test.'
      };
      const extendedAnswers = {
        5: 'Test.',
        6: 'Test.',
        7: 'Test.',
        8: 'Test.',
        9: 'Test.',
        10: 'Test.',
        11: 'Test.',
        12: 'Test.'
      };

      const result = assessVerdict(coreAnswers, extendedAnswers);
      expect(result).toHaveProperty('verdict');
      expect(result).toHaveProperty('blockers');
      expect(result).toHaveProperty('risks');
      expect(result).toHaveProperty('ready');
      expect(result).toHaveProperty('nextSteps');
      expect(result).toHaveProperty('reasoning');
      expect(['RED', 'YELLOW', 'GREEN']).toContain(result.verdict);
    });
  });
});
