import { resolveOpenRouterCredential } from './credential';
import { resolveChangedFiles } from './file-list';
import { runSlopGrader, type SlopFinding } from './slop-grader-runner';

export interface ChangedRunResult {
  skipped: boolean;
  reason?: string;
  findings: SlopFinding[];
}

export async function runChanged(cwd: string = process.cwd()): Promise<ChangedRunResult> {
  const files = resolveChangedFiles(cwd);
  if (files.length === 0) {
    return { skipped: true, reason: 'no staged markdown files', findings: [] };
  }

  const credential = resolveOpenRouterCredential();
  if (!credential.ok) {
    return { skipped: true, reason: credential.reason, findings: [] };
  }

  const result = await runSlopGrader(files, credential.apiKey);
  if (!result.ok) {
    return { skipped: true, reason: result.reason, findings: [] };
  }

  return { skipped: false, findings: result.findings };
}

export function printChangedSummary(result: ChangedRunResult): void {
  if (result.skipped) {
    if (result.reason && result.reason !== 'no staged markdown files') {
      console.log(`slop-grader unavailable: ${result.reason}, skipping`);
    }
    return;
  }

  if (result.findings.length === 0) {
    console.log('slop-grader: no findings');
    return;
  }

  console.log(`slop-grader: ${result.findings.length} finding(s)`);
  for (const finding of result.findings) {
    console.log(
      `  ${finding.file}:L${finding.line} [${finding.severity}] ${finding.rule} - ${finding.message}`
    );
  }
}
