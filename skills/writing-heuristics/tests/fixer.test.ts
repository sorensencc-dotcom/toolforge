import { describe, it, expect } from 'vitest';
import { applyFixes, toSentenceCase } from '../src/fixer';
import { lintText } from '../src/linter';

describe('Safe Fixer Suite', () => {
  it('converts Title Case to Sentence case', () => {
    expect(toSentenceCase('Deployment Configuration And Setup')).toBe('Deployment configuration and setup');
    expect(toSentenceCase('Working with HTTP and API')).toBe('Working with HTTP and API');
  });

  it('autofixes ban-throat-clearing and heading-sentence-case safely', () => {
    const input = `## Deployment Configuration And Setup\n\nCertainly! To start the service, run command.\n`;
    const lintRes = lintText(input);
    const fixRes = applyFixes(input, lintRes.violations);

    expect(fixRes.appliedCount).toBe(2);
    expect(fixRes.fixedContent).toContain('## Deployment configuration and setup');
    expect(fixRes.fixedContent).toContain('To start the service, run command.');
    expect(fixRes.fixedContent).not.toContain('Certainly!');
  });
});
