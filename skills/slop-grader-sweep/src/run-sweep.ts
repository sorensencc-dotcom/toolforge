import { writeFileSync } from 'node:fs';
import { resolveOpenRouterCredential } from './credential';
import { resolveSweepFiles } from './file-list';
import { runSlopGrader, type SlopFinding } from './slop-grader-runner';
import { formatSlopReport } from './report-formatter';

const DEFAULT_REPORT_PATH = 'drift/SLOP-REPORT.md';
const RETRY_DELAY_MS = 5000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runSweep(
  cwd: string = process.cwd(),
  reportPath: string = DEFAULT_REPORT_PATH
): Promise<void> {
  const files = resolveSweepFiles(cwd);
  const generatedAt = new Date().toISOString();

  const credential = resolveOpenRouterCredential();
  if (!credential.ok) {
    writeDegraded(reportPath, generatedAt, credential.reason);
    return;
  }

  let result = await runSlopGrader(files, credential.apiKey);
  if (!result.ok) {
    await sleep(RETRY_DELAY_MS);
    result = await runSlopGrader(files, credential.apiKey);
  }

  if (!result.ok) {
    writeDegraded(reportPath, generatedAt, result.reason);
    return;
  }

  const findingsByFile = groupByFile(files, result.findings);
  const report = formatSlopReport(findingsByFile, { generatedAt });
  writeFileSync(reportPath, report, 'utf8');
}

function writeDegraded(reportPath: string, generatedAt: string, reason: string): void {
  const report = formatSlopReport(new Map(), {
    generatedAt,
    degraded: true,
    degradedReason: reason,
  });
  writeFileSync(reportPath, report, 'utf8');
}

function groupByFile(files: string[], findings: SlopFinding[]): Map<string, SlopFinding[]> {
  const map = new Map<string, SlopFinding[]>();
  for (const file of files) {
    map.set(file, []);
  }
  for (const finding of findings) {
    const list = map.get(finding.file) ?? [];
    list.push(finding);
    map.set(finding.file, list);
  }
  return map;
}
