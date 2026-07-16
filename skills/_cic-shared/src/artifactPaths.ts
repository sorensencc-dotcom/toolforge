import * as path from 'path';

export interface ArtifactPaths {
  dir: string;
  resultFile: string;
}

export function artifactPaths(kind: string, id: string): ArtifactPaths {
  const dir = path.join(process.cwd(), 'cic', 'artifacts', kind, id);
  return { dir, resultFile: path.join(dir, 'result.json') };
}
