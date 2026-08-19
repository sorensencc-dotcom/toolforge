import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { applyFixes, safeFixFile, toSentenceCase } from '../src/fixer';
import { lintText } from '../src/linter';

describe('Safe Fixer and Atomic Windows Transform Suite', () => {
  it('converts Title Case headings to Sentence case', () => {
    expect(toSentenceCase('Deployment Configuration And Setup')).toBe('Deployment configuration and setup');
    expect(toSentenceCase('Advanced Database Management')).toBe('Advanced database management');
  });

  it('preserves acronyms and uppercase tokens during sentence casing', () => {
    expect(toSentenceCase('Working with HTTP and API Endpoints')).toBe('Working with HTTP and API endpoints');
    expect(toSentenceCase('Configuring JSON and YAML Parsers')).toBe('Configuring JSON and YAML parsers');
  });

  it('preserves code spans in headings', () => {
    expect(toSentenceCase('Using `fetch` API For Requests')).toBe('Using `fetch` API for requests');
  });

  it('autofixes ban-throat-clearing safely', () => {
    const input = 'Certainly! To configure the server, run setup.';
    const lintRes = lintText(input);
    const fixRes = applyFixes(input, lintRes.violations);
    expect(fixRes.appliedCount).toBe(1);
    expect(fixRes.fixedContent).toBe('To configure the server, run setup.');
  });

  it('autofixes heading-sentence-case safely', () => {
    const input = '## Advanced Deployment Configuration And Setup';
    const lintRes = lintText(input);
    const fixRes = applyFixes(input, lintRes.violations);
    expect(fixRes.appliedCount).toBe(1);
    expect(fixRes.fixedContent).toBe('## Advanced deployment configuration and setup');
  });

  it('refuses to autofix advisory or low-confidence rules (< 0.95)', () => {
    const input = 'Supports JSON, YAML and TOML formats.\nThe backup is triggered by scheduler.\n';
    const lintRes = lintText(input);
    const fixRes = applyFixes(input, lintRes.violations);
    expect(fixRes.appliedCount).toBe(0);
    expect(fixRes.fixedContent).toBe(input);
  });

  it('preserves CRLF Windows line endings in fixed files', () => {
    const input = '## System Setup And Config\r\n\r\nCertainly! Run the tool.\r\n';
    const lintRes = lintText(input);
    const fixRes = applyFixes(input, lintRes.violations);
    expect(fixRes.fixedContent).toContain('\r\n');
    expect(fixRes.fixedContent.includes('\n') && !fixRes.fixedContent.includes('\r\n')).toBe(false);
  });

  it('preserves UTF-8 BOM marker in fixed files', () => {
    const input = '\uFEFF## System Setup And Config\n\nCertainly! Run the tool.\n';
    const lintRes = lintText(input);
    const fixRes = applyFixes(input, lintRes.violations);
    expect(fixRes.fixedContent.charCodeAt(0)).toBe(0xfeff);
  });

  it('safeFixFile dryRun mode leaves disk file unchanged', async () => {
    const tmpDir = os.tmpdir();
    const testFile = path.join(tmpDir, `test-fix-${Date.now()}.md`);
    const input = '## System Setup And Config\n\nCertainly! Run the tool.\n';
    fs.writeFileSync(testFile, input, 'utf8');

    try {
      const res = await safeFixFile(testFile, { dryRun: true });
      expect(res.appliedCount).toBe(2);
      const onDisk = fs.readFileSync(testFile, 'utf8');
      expect(onDisk).toBe(input);
    } finally {
      if (fs.existsSync(testFile)) fs.unlinkSync(testFile);
    }
  });
});
