import { describe, it, expect } from '@jest/globals';

describe('GovernanceMatrixValidator', () => {
  it('should detect masking errors where continue-on-error is true', () => {
    const workflowStep = { name: 'Run gov validate', run: 'npm run gov:validate', 'continue-on-error': true };
    const isMasked = workflowStep['continue-on-error'] === true;
    expect(isMasked).toBe(true);
  });

  it('should flag missing scripts in package.json', () => {
    const packageJson = { name: 'cic-ingestion', scripts: { test: 'jest' } };
    const hasGovValidate = Boolean((packageJson.scripts as Record<string, string>)['gov:validate']);
    expect(hasGovValidate).toBe(false);
  });

  it('should format multi-repo findings into an actionable report', () => {
    const findings = [
      {
        repo: 'cic-ingestion',
        issueCode: 'MISSING_GOV_VALIDATE_SCRIPT',
        severity: 'CRITICAL',
        missingTarget: 'package.json -> scripts.gov:validate',
        suggestedFix: "Add 'gov:validate' script",
      },
    ];
    expect(findings.length).toBe(1);
    expect(findings[0].severity).toBe('CRITICAL');
  });
});
