import { generateRunId } from '../../_cic-shared/src/runId';
import { writeResultJson } from '../../_cic-shared/src/writeResultJson';
import { artifactPaths } from '../../_cic-shared/src/artifactPaths';

export interface RepairInput { pipelineId: string; failureContext?: string; }
export interface RepairOutput { runId: string; status: 'stub'; patchSetPath: string; commands: string[]; timestamp: string; }

export async function main(input: RepairInput): Promise<RepairOutput> {
  const runId = generateRunId();
  const { dir } = artifactPaths('repair', runId);
  const result: RepairOutput = { runId, status: 'stub', patchSetPath: `${dir}/patchset.json`, commands: [], timestamp: new Date().toISOString() };
  await writeResultJson('repair', runId, result as unknown as Record<string, unknown>);
  return result;
}
export default main;
