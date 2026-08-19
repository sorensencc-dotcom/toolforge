import { LintResult, SuppressionDirective } from './types';

export function formatStylish(results: LintResult[]): string {
  let output = '';
  let totalErrors = 0;
  let totalWarnings = 0;

  for (const res of results) {
    if (res.violations.length === 0) continue;

    output += `\n${res.filePath ?? 'stdin'}\n`;
    for (const v of res.violations) {
      const color = v.severity === 'error' ? '\x1b[31merror\x1b[0m' : '\x1b[33mwarning\x1b[0m';
      output += `  ${v.line}:${v.column}  ${color}  ${v.message}  \x1b[90m${v.ruleId}\x1b[0m\n`;
      if (v.severity === 'error') totalErrors++;
      else totalWarnings++;
    }
  }

  const total = totalErrors + totalWarnings;
  if (total > 0) {
    output += `\n\x1b[1m\x1b[31m✖ ${total} problem${total === 1 ? '' : 's'} (${totalErrors} error${totalErrors === 1 ? '' : 's'}, ${totalWarnings} warning${totalWarnings === 1 ? '' : 's'})\x1b[0m\n`;
  } else {
    output += `\n\x1b[32m✔ All writing heuristics passed successfully!\x1b[0m\n`;
  }

  return output;
}

export function formatJson(results: LintResult[]): string {
  const totalFiles = results.length;
  let totalErrors = 0;
  let totalWarnings = 0;
  const allSuppressions: SuppressionDirective[] = [];

  for (const r of results) {
    totalErrors += r.errorCount;
    totalWarnings += r.warningCount;
    allSuppressions.push(...r.suppressions);
  }

  return JSON.stringify(
    {
      summary: {
        filesScanned: totalFiles,
        errors: totalErrors,
        warnings: totalWarnings,
        clean: totalErrors === 0 && totalWarnings === 0,
      },
      suppressions: allSuppressions,
      files: results,
    },
    null,
    2
  );
}

export function formatSarif(results: LintResult[]): string {
  const runs = [
    {
      tool: {
        driver: {
          name: 'toolforge-writing-heuristics',
          informationUri: 'https://github.com/sorensencc-dotcom/toolforge',
          rules: [
            { id: 'ban-throat-clearing', name: 'Ban Throat Clearing' },
            { id: 'heading-sentence-case', name: 'Heading Sentence Case' },
            { id: 'descriptive-links', name: 'Descriptive Links' },
          ],
        },
      },
      results: results.flatMap((r) =>
        r.violations.map((v) => ({
          ruleId: v.ruleId,
          level: v.severity === 'error' ? 'error' : 'warning',
          message: { text: v.message },
          locations: [
            {
              physicalLocation: {
                artifactLocation: { uri: r.filePath ?? 'stdin' },
                region: { startLine: v.line, startColumn: v.column },
              },
            },
          ],
        }))
      ),
    },
  ];

  return JSON.stringify({ version: '2.1.0', $schema: 'https://schemastore.azurewebsites.net/schemas/v2.1.0/sarif-schema.json', runs }, null, 2);
}
