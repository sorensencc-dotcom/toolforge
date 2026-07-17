import { generateRunId } from '../../_cic-shared/src/runId';
import { writeResultJson } from '../../_cic-shared/src/writeResultJson';
import ingestMain from '../../cic-ingest-world/src/index';
import gateMain from '../../cic-run-gate/src/index';
import repairMain from '../../cic-repair-pipeline/src/index';
import consolidateMain from '../../cic-consolidate-artifacts/src/index';

export interface OrchestrateInput {
  sourceId: string;
  gateId?: string;
  profile?: string;
}

export type StepName = 'ingest' | 'gate' | 'repair' | 'consolidate';

export interface FlowStep {
  step: StepName;
  runId?: string;
  status: string;
}

export interface OrchestrateOutput {
  flowId: string;
  overallStatus: 'PASS' | 'FAIL' | 'ERROR';
  steps: FlowStep[];
  bundleId?: string;
  bundlePath?: string;
  flowPath: string;
  timestamp: string;
}

async function writeFlowResult(
  flowId: string,
  steps: FlowStep[],
  overallStatus: 'PASS' | 'FAIL' | 'ERROR',
  bundleId?: string,
  bundlePath?: string
): Promise<OrchestrateOutput> {
  const timestamp = new Date().toISOString();
  const flowPath = await writeResultJson('flow', flowId, {
    flowId,
    overallStatus,
    steps,
    bundleId,
    bundlePath,
    timestamp,
  });
  return { flowId, overallStatus, steps, bundleId, bundlePath, flowPath, timestamp };
}

export async function main(input: OrchestrateInput): Promise<OrchestrateOutput> {
  const flowId = generateRunId();
  const steps: FlowStep[] = [];
  const gateId = input.gateId ?? 'GATE-01';

  let ingestResult;
  try {
    ingestResult = await ingestMain({ sourceId: input.sourceId });
    steps.push({ step: 'ingest', runId: ingestResult.runId, status: ingestResult.status });
  } catch {
    steps.push({ step: 'ingest', status: 'ERROR' });
    return writeFlowResult(flowId, steps, 'ERROR');
  }

  let gateResult: { status: 'PASS' | 'FAIL' | 'ERROR'; message: string; runId?: string };
  try {
    const result = await gateMain({ gateId, profile: input.profile });
    gateResult = result;
    steps.push({ step: 'gate', runId: result.runId, status: result.status });
  } catch {
    gateResult = { status: 'ERROR', message: 'gate step threw' };
    steps.push({ step: 'gate', status: 'ERROR' });
  }

  if (gateResult.status !== 'PASS') {
    try {
      const repairResult = await repairMain({ pipelineId: gateId, failureContext: gateResult.message });
      steps.push({ step: 'repair', runId: repairResult.runId, status: repairResult.status });
    } catch {
      steps.push({ step: 'repair', status: 'ERROR' });
    }
  } else {
    steps.push({ step: 'repair', status: 'SKIPPED' });
  }

  const runIds = steps.filter((s) => s.runId).map((s) => s.runId as string);
  let bundleId: string | undefined;
  let bundlePath: string | undefined;
  try {
    const consolidateResult = await consolidateMain({ runIds, profile: input.profile });
    bundleId = consolidateResult.bundleId;
    bundlePath = consolidateResult.bundlePath;
    steps.push({ step: 'consolidate', runId: consolidateResult.bundleId, status: consolidateResult.status });
  } catch {
    steps.push({ step: 'consolidate', status: 'ERROR' });
  }

  const overallStatus = steps.some((s) => s.status === 'ERROR') ? 'ERROR' : gateResult.status;
  return writeFlowResult(flowId, steps, overallStatus, bundleId, bundlePath);
}

export default main;
