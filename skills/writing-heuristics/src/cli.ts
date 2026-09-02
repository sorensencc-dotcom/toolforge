#!/usr/bin/env node
import * as fs from 'fs';
import * as path from 'path';
import { lintFile, lintText } from './linter';
import { safeFixFile, applyFixes } from './fixer';
import { formatJson, formatSarif, formatStylish } from './formatters';
import { LintResult } from './types';

export async function runCli(argv: string[] = process.argv.slice(2)): Promise<number> {
  const command = argv[0] ?? 'check';
  const flags = argv.slice(1);

  const isStdin = flags.includes('--stdin');
  const isStrict = flags.includes('--strict');
  const isDryRun = flags.includes('--dry-run');
  const formatFlag = flags.find((f) => f.startsWith('--format='));
  const format = formatFlag ? formatFlag.split('=')[1] : 'stylish';

  const globs = flags.filter((f) => !f.startsWith('--') && f !== command);

  if (command === '--help' || command === '-h' || flags.includes('--help')) {
    process.stdout.write(`Toolforge Writing Heuristics Linter & Fixer
Usage:
  lint-heuristics check [globs...] [--stdin] [--strict] [--format=stylish|json|sarif]
  lint-heuristics fix [globs...] [--stdin] [--dry-run]
\n`);
    return 0;
  }

  if (command === '--version' || command === '-v') {
    process.stdout.write('1.0.0\n');
    return 0;
  }

  if (isStdin) {
    const input = fs.readFileSync(0, 'utf8');
    if (command === 'fix') {
      const lintRes = lintText(input);
      const fixRes = applyFixes(input, lintRes.violations);
      process.stdout.write(fixRes.fixedContent);
      return 0;
    } else {
      const res = lintText(input, { strict: isStrict });
      if (format === 'json') process.stdout.write(formatJson([res]));
      else if (format === 'sarif') process.stdout.write(formatSarif([res]));
      else process.stderr.write(formatStylish([res]));

      if (res.errorCount > 0 || (isStrict && res.warningCount > 0)) {
        return 1;
      }
      return 0;
    }
  }

  // File checking
  const files: string[] = [];
  for (const g of globs) {
    if (fs.existsSync(g)) {
      const stat = fs.statSync(g);
      if (stat.isDirectory()) {
        const findMd = (d: string) => {
          for (const item of fs.readdirSync(d)) {
            const full = path.join(d, item);
            if (fs.statSync(full).isDirectory()) findMd(full);
            else if (full.endsWith('.md')) files.push(full);
          }
        };
        findMd(g);
      } else {
        files.push(g);
      }
    }
  }

  if (files.length === 0) {
    if (globs.length > 0) {
      process.stderr.write(`No markdown files found matching pattern: ${globs.join(' ')}\n`);
      return 2;
    }
    process.stdout.write('No files specified. Run with --help for usage.\n');
    return 0;
  }

  if (command === 'fix') {
    let anyFixed = false;
    for (const f of files) {
      const res = await safeFixFile(f, { dryRun: isDryRun });
      if (res.appliedCount > 0) {
        anyFixed = true;
        process.stdout.write(`${isDryRun ? '[DRY RUN] ' : ''}Fixed ${res.appliedCount} issues in ${f}\n`);
      }
    }
    if (!anyFixed) {
      process.stdout.write('No autofixable issues found.\n');
    }
    return 0;
  }

  const results: LintResult[] = [];
  for (const f of files) {
    results.push(await lintFile(f, { strict: isStrict }));
  }

  if (format === 'json') process.stdout.write(formatJson(results) + '\n');
  else if (format === 'sarif') process.stdout.write(formatSarif(results) + '\n');
  else process.stdout.write(formatStylish(results));

  const totalErrors = results.reduce((sum, r) => sum + r.errorCount, 0);
  const totalWarnings = results.reduce((sum, r) => sum + r.warningCount, 0);

  if (totalErrors > 0 || (isStrict && totalWarnings > 0)) {
    return 1;
  }
  return 0;
}

runCli().then((code) => {
  if (code !== 0) process.exit(code);
});
