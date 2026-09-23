import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { resolveOpenRouterCredential } from './credential';
import { resolveSweepFiles } from './file-list';
import { runSlopGrader, SWEEP_TIMEOUT_MS, type SlopFinding } from './slop-grader-runner';
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
  const generatedAt = new Date().toISOString();

  // Advisory-only: no failure mode may exit non-zero or crash the workflow.
  // Mirrors the Task 6 ruling already applied to runChanged.
  try {
    const files = resolveSweepFiles(cwd);

    const credential = resolveOpenRouterCredential();
    if (!credential.ok) {
      writeDegraded(reportPath, generatedAt, credential.reason);
      return;
    }

    let result = await runSlopGrader(files, credential.apiKey, SWEEP_TIMEOUT_MS);
    if (!result.ok) {
      await sleep(RETRY_DELAY_MS);
      result = await runSlopGrader(files, credential.apiKey, SWEEP_TIMEOUT_MS);
    }

    if (!result.ok) {
      writeDegraded(reportPath, generatedAt, result.reason);
      return;
    }

    const findingsByFile = groupByFile(files, result.findings);
    const partialFailures = result.errors ?? [];
    const report = formatSlopReport(findingsByFile, {
      generatedAt,
      degraded: partialFailures.length > 0,
      degradedReason:
        partialFailures.length > 0
          ? `${partialFailures.length} of ${files.length} file(s) failed: ${partialFailures[0]}`
          : undefined,
    });
    writeReport(reportPath, report);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    try {
      writeDegraded(reportPath, generatedAt, message);
    } catch {
      // Report path itself is unwritable — still never fail the workflow.
      console.error(`slop-grader sweep could not write a report: ${message}`);
    }
  }
}

function writeReport(reportPath: string, report: string): void {
  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, report, 'utf8');
}

function writeDegraded(reportPath: string, generatedAt: string, reason: string): void {
  const report = formatSlopReport(new Map(), {
    generatedAt,
    degraded: true,
    degradedReason: reason,
  });
  writeReport(reportPath, report);
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
