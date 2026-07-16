import { generateRunId } from '../../_cic-shared/src/runId';
import { writeResultJson } from '../../_cic-shared/src/writeResultJson';
import { artifactPaths } from '../../_cic-shared/src/artifactPaths';

export interface IngestInput {
  sourceId: string;
  schemaRef?: string;
  targetSystem?: string;
}

export interface IngestOutput {
  runId: string;
  status: 'stub';
  artifactsPath: string;
  lineageRef: string;
  timestamp: string;
}

export async function main(input: IngestInput): Promise<IngestOutput> {
  const runId = generateRunId();
  const { dir } = artifactPaths('ingest', runId);
  const result: IngestOutput = {
    runId,
    status: 'stub',
    artifactsPath: dir,
    lineageRef: `lineage:ingest:${input.sourceId}:${runId}`,
    timestamp: new Date().toISOString(),
  };
  await writeResultJson('ingest', runId, result as unknown as Record<string, unknown>);
  return result;
}

export default main;
