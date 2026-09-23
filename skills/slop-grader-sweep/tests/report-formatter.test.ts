import { describe, it, expect } from 'vitest';
import { formatSlopReport } from '../src/report-formatter';
import type { SlopFinding } from '../src/slop-grader-runner';

describe('formatSlopReport', () => {
  it('renders a no-findings report', () => {
    const report = formatSlopReport(new Map(), { generatedAt: '2026-09-22T10:00:00.000Z' });

    expect(report).toContain('# Slop Grader Sweep Report');
    expect(report).toContain('**Generated**: 2026-09-22T10:00:00.000Z');
    expect(report).toContain('**Total findings**: 0');
    expect(report).toContain('No findings.');
  });

  it('groups findings by file, sorted', () => {
    const findings: SlopFinding[] = [
      { file: 'docs/b.md', line: 5, rule: 'empty_adverb', severity: 'warning', message: 'drop it' },
      { file: 'docs/a.md', line: 2, rule: 'throat_clearing', severity: 'error', message: 'cut it' },
    ];
    const byFile = new Map<string, SlopFinding[]>([
      ['docs/a.md', [findings[1]]],
      ['docs/b.md', [findings[0]]],
    ]);

    const report = formatSlopReport(byFile, { generatedAt: '2026-09-22T10:00:00.000Z' });

    const aIndex = report.indexOf('### docs/a.md');
    const bIndex = report.indexOf('### docs/b.md');
    expect(aIndex).toBeGreaterThan(-1);
    expect(bIndex).toBeGreaterThan(aIndex);
    expect(report).toContain('L2: **throat_clearing** (error) - cut it');
    expect(report).toContain('**Total findings**: 2');
  });

  it('renders document-scope findings (line 0) as Document-level', () => {
    const byFile = new Map<string, SlopFinding[]>([
      [
        'docs/a.md',
        [
          {
            file: 'docs/a.md',
            line: 0,
            rule: 'narrative_arc',
            severity: 'document',
            message: 'Loosely organized (score 1.4/3)',
          },
        ],
      ],
    ]);

    const report = formatSlopReport(byFile, { generatedAt: '2026-09-22T10:00:00.000Z' });

    expect(report).toContain('- Document-level: **narrative_arc** (document) - Loosely organized (score 1.4/3)');
    expect(report).not.toContain('L0:');
  });

  it('renders a DEGRADED status header when degraded', () => {
    const report = formatSlopReport(new Map(), {
      generatedAt: '2026-09-22T10:00:00.000Z',
      degraded: true,
      degradedReason: 'OpenRouter timeout',
    });

    expect(report).toContain('**Status**: DEGRADED (OpenRouter timeout)');
  });
});
