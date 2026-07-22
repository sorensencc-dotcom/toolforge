import * as fs from 'fs';
import * as path from 'path';

const ARTIFACT_DIR = path.resolve(__dirname, '../artifacts/threshold');
const LINEAGE_LOG = path.resolve(__dirname, '../lineage/lineage-log.json');

interface CICVisionThresholdArtifact {
  artifact_type: 'CIC-VISION-THRESHOLD';
  version: string;
  timestamp: string;
  baseline_avg: number;
  structure_avg: number;
  enrichment_delta_avg: number;
  current_threshold: number;
  provider_chain_stats: Record<string, any>;
  update_reason: string;
  executed_by: string;
  status: 'pending' | 'ratified';
  parent_lineage: string | null;
  hash: string;
}

export function loadArtifact(version: string): CICVisionThresholdArtifact {
  const filePath = path.join(ARTIFACT_DIR, `${version}.json`);

  if (!fs.existsSync(filePath)) {
    throw new Error(`Artifact not found: ${version}`);
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content) as CICVisionThresholdArtifact;
}

export function saveArtifact(artifact: CICVisionThresholdArtifact): void {
  const filePath = path.join(ARTIFACT_DIR, `${artifact.version}.json`);

  fs.writeFileSync(filePath, JSON.stringify(artifact, null, 2), 'utf-8');
}

export async function ratifyThreshold(
  artifactVersion: string,
  actor: string
): Promise<void> {
  // Load artifact
  const artifact = loadArtifact(artifactVersion);

  // Validate actor matches executor
  if (artifact.executed_by !== actor) {
    throw new Error(
      `Only the executing actor (${artifact.executed_by}) may ratify. Got: ${actor}`
    );
  }

  // Validate status
  if (artifact.status !== 'pending') {
    throw new Error(
      `Artifact ${artifactVersion} is already ${artifact.status}. Cannot ratify non-pending artifacts.`
    );
  }

  // Update status
  artifact.status = 'ratified';
  artifact.timestamp = new Date().toISOString();

  // Save updated artifact
  saveArtifact(artifact);

  // Append to lineage log
  appendLineageEntry({
    artifact_version: artifactVersion,
    operation: 'RATIFY',
    actor,
    status: 'ratified',
  });
}

interface LineageEntry {
  id?: string;
  artifact_version: string;
  operation: 'CREATE' | 'UPDATE' | 'RATIFY' | 'ACTIVATE';
  actor: string;
  timestamp?: string;
  status: 'pending' | 'ratified' | 'active';
  reason?: string;
}

function appendLineageEntry(entry: LineageEntry): void {
  let log: { entries: LineageEntry[] } = { entries: [] };

  // Load existing log if it exists
  if (fs.existsSync(LINEAGE_LOG)) {
    try {
      const content = fs.readFileSync(LINEAGE_LOG, 'utf-8');
      log = JSON.parse(content);
    } catch (e) {
      // Log file corrupted or empty, start fresh
      log = { entries: [] };
    }
  }

  // Generate operation ID
  const opId = `OP-${String(log.entries.length + 1).padStart(4, '0')}`;

  // Add entry
  const newEntry: LineageEntry = {
    id: opId,
    timestamp: new Date().toISOString(),
    ...entry,
  };

  log.entries.push(newEntry);

  // Write updated log
  const logDir = path.dirname(LINEAGE_LOG);
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  fs.appendFileSync(
    LINEAGE_LOG,
    JSON.stringify(newEntry, null, 2) + '\n',
    'utf-8'
  );
}

export function getLineageLog(): { entries: LineageEntry[] } {
  if (!fs.existsSync(LINEAGE_LOG)) {
    return { entries: [] };
  }

  const content = fs.readFileSync(LINEAGE_LOG, 'utf-8');
  return JSON.parse(content);
}
