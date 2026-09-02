import * as fs from 'fs/promises';
import { artifactPaths } from './artifactPaths';

export async function writeResultJson(
  kind: string,
  id: string,
  payload: Record<string, unknown>
): Promise<string> {
  const { dir, resultFile } = artifactPaths(kind, id);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(resultFile, JSON.stringify(payload, null, 2), 'utf-8');
  return resultFile;
}
