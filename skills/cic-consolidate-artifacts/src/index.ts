import { generateBundleId } from '../../_cic-shared/src/runId';
import { writeResultJson } from '../../_cic-shared/src/writeResultJson';
import { artifactPaths } from '../../_cic-shared/src/artifactPaths';
import { formatGovernanceTag } from '../../_cic-shared/src/governanceTag';

export interface ConsolidateInput { runIds: string[]; profile?: string; }
export interface ConsolidateOutput { bundleId: string; status: 'stub'; bundlePath: string; governanceTag: string; timestamp: string; }

export async function main(input: ConsolidateInput): Promise<ConsolidateOutput> {
  const bundleId = generateBundleId();
  const { dir } = artifactPaths('consolidate', bundleId);
  const result: ConsolidateOutput = {
    bundleId,
    status: 'stub',
    bundlePath: `${dir}/bundle.json`,
    governanceTag: formatGovernanceTag({ runId: bundleId, profileId: input.profile }),
    timestamp: new Date().toISOString(),
  };
  await writeResultJson('consolidate', bundleId, result as unknown as Record<string, unknown>);
  return result;
}
export default main;
