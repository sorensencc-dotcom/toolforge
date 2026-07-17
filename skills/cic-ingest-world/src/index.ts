import { generateRunId } from '../../_cic-shared/src/runId';
import { writeResultJson } from '../../_cic-shared/src/writeResultJson';
import { artifactPaths } from '../../_cic-shared/src/artifactPaths';
import { writeLineageEntry } from '../../_cic-shared/src/writeLineageEntry';
import { formatGovernanceTag } from '../../_cic-shared/src/governanceTag';

export interface IngestInput {
  sourceId: string;
  schemaRef?: string;
  targetSystem?: string;
  profile?: string;
}

export interface IngestOutput {
  runId: string;
  status: 'stub';
  artifactsPath: string;
  lineageRef: string;
  governanceTag: string;
  timestamp: string;
}

export async function main(input: IngestInput): Promise<IngestOutput> {
  const runId = generateRunId();
  const { dir } = artifactPaths('ingest', runId);
  const timestamp = new Date().toISOString();
  const lineageRef = `lineage:ingest:${input.sourceId}:${runId}`;
  const result: IngestOutput = {
    runId,
    status: 'stub',
    artifactsPath: dir,
    lineageRef,
    governanceTag: formatGovernanceTag({ runId, profileId: input.profile }),
    timestamp,
  };
  await writeResultJson('ingest', runId, result as unknown as Record<string, unknown>);
  await writeLineageEntry('ingest', runId, {
    runId, lineageRef, sourceId: input.sourceId, status: 'stub', timestamp,
  });
  return result;
}

export default main;
