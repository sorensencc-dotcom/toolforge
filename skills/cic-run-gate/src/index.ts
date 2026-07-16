import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs/promises';
import { generateRunId } from '../../_cic-shared/src/runId';
import { writeResultJson } from '../../_cic-shared/src/writeResultJson';
import { artifactPaths } from '../../_cic-shared/src/artifactPaths';
import { writeReportEntry } from '../../_cic-shared/src/writeReportEntry';

export interface RunGateInput { gateId: string; scope?: string; profile?: string; }
interface AdapterPayload { status: 'PASS' | 'FAIL' | 'ERROR'; violations: { testId: string; description: string; outcome: string }[]; message: string; }
export interface RunGateOutput extends AdapterPayload { runId: string; gateId: string; reportPath: string; artifactsPath: string; timestamp: string; }
const GATE_ID_PATTERN = /^GATE-\d{2}$/;
const ADAPTER_PATH = path.resolve(__dirname, '../../../CIC-GOVERNANCE/adapters/run_gate_adapter.py');
const ADAPTER_CWD = path.resolve(__dirname, '../../../CIC-GOVERNANCE');
const SPAWN_TIMEOUT_MS = 15000;

function runAdapter(gateId: string): Promise<AdapterPayload> {
  return new Promise((resolve) => {
    const child = spawn('python', [ADAPTER_PATH, gateId], { cwd: ADAPTER_CWD });
    let stdout = ''; let stderr = '';
    const timer = setTimeout(() => { child.kill(); resolve({ status: 'ERROR', violations: [], message: 'adapter timed out' }); }, SPAWN_TIMEOUT_MS);
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('close', (code) => { clearTimeout(timer); if (code !== 0) { resolve({ status: 'ERROR', violations: [], message: `adapter exited ${code}: ${stderr.trim()}` }); return; } try { const line = stdout.trim().split('\n').filter(Boolean)[0] ?? ''; resolve(JSON.parse(line)); } catch { resolve({ status: 'ERROR', violations: [], message: 'adapter produced invalid JSON' }); } });
    child.on('error', (err) => { clearTimeout(timer); resolve({ status: 'ERROR', violations: [], message: `failed to spawn adapter: ${err.message}` }); });
  });
}

export async function main(input: RunGateInput): Promise<RunGateOutput> {
  const runId = generateRunId(); const { dir } = artifactPaths('gates', runId);
  let payload: AdapterPayload;
  if (!GATE_ID_PATTERN.test(input.gateId)) payload = { status: 'ERROR', violations: [], message: `invalid gateId: ${input.gateId}` };
  else payload = await runAdapter(input.gateId);
  const reportPath = path.join(dir, 'report.json'); await fs.mkdir(dir, { recursive: true }); await fs.writeFile(reportPath, JSON.stringify(payload, null, 2), 'utf-8');
  const timestamp = new Date().toISOString();
  const result: RunGateOutput = { ...payload, runId, gateId: input.gateId, reportPath, artifactsPath: dir, timestamp };
  await writeResultJson('gates', runId, result as unknown as Record<string, unknown>);
  await writeReportEntry('gates', runId, { runId, gateId: input.gateId, status: payload.status, reportPath, timestamp });
  return result;
}
export default main;
