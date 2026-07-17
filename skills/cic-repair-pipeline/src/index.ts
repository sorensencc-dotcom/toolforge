import { generateRunId } from '../../_cic-shared/src/runId';
import { writeResultJson } from '../../_cic-shared/src/writeResultJson';
import { artifactPaths } from '../../_cic-shared/src/artifactPaths';
import { formatGovernanceTag } from '../../_cic-shared/src/governanceTag';

export interface RepairInput { pipelineId: string; failureContext?: string; profile?: string; }
export interface RepairOutput { runId: string; status: 'stub'; patchSetPath: string; commands: string[]; governanceTag: string; timestamp: string; }

export async function main(input: RepairInput): Promise<RepairOutput> {
  const runId = generateRunId();
  const { dir } = artifactPaths('repair', runId);
  const result: RepairOutput = {
    runId,
    status: 'stub',
    patchSetPath: `${dir}/patchset.json`,
    commands: [],
    governanceTag: formatGovernanceTag({ runId, profileId: input.profile }),
    timestamp: new Date().toISOString(),
  };
  await writeResultJson('repair', runId, result as unknown as Record<string, unknown>);
  return result;
}
export default main;
