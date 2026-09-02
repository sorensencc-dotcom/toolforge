import * as fs from 'fs/promises';
import { lineagePaths } from './lineagePaths';

export async function writeLineageEntry(
  kind: string,
  id: string,
  payload: Record<string, unknown>
): Promise<string> {
  const { dir, file } = lineagePaths(kind, id);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(file, JSON.stringify(payload, null, 2), 'utf-8');
  return file;
}
