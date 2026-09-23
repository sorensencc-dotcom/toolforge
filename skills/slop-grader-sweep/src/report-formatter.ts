import type { SlopFinding } from './slop-grader-runner';

export interface ReportOptions {
  generatedAt: string;
  degraded?: boolean;
  degradedReason?: string;
}

export function formatSlopReport(
  findingsByFile: Map<string, SlopFinding[]>,
  options: ReportOptions
): string {
  const lines: string[] = [];
  lines.push('# Slop Grader Sweep Report');
  lines.push('');
  lines.push(`**Generated**: ${options.generatedAt}`);

  if (options.degraded) {
    lines.push('');
    lines.push(`**Status**: DEGRADED (${options.degradedReason ?? 'unknown reason'})`);
  }

  lines.push('');
  lines.push('---');
  lines.push('');

  const totalFindings = Array.from(findingsByFile.values()).reduce(
    (sum, findings) => sum + findings.length,
    0
  );

  lines.push('## Summary');
  lines.push('');
  lines.push(`**Files scanned**: ${findingsByFile.size}`);
  lines.push(`**Total findings**: ${totalFindings}`);
  lines.push('');

  if (totalFindings === 0) {
    lines.push('No findings.');
    return lines.join('\n') + '\n';
  }

  lines.push('## Findings');
  lines.push('');

  const sortedEntries = Array.from(findingsByFile.entries()).sort(([a], [b]) => a.localeCompare(b));

  for (const [file, findings] of sortedEntries) {
    if (findings.length === 0) continue;
    lines.push(`### ${file}`);
    lines.push('');
    for (const finding of findings) {
      // Document-scope rules carry no line number and arrive as line 0.
      const locator = finding.line === 0 ? 'Document-level' : `L${finding.line}`;
      lines.push(`- ${locator}: **${finding.rule}** (${finding.severity}) - ${finding.message}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}
