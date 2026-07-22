import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { getAdaptiveThreshold } from '../../../src/harvester/external/vision/adaptiveThreshold';

const ARTIFACT_DIR = path.resolve(__dirname, '../artifacts/threshold');

interface ProviderStats {
  calls: number;
  successes: number;
  avg_confidence: number;
  last_call: string | null;
}

interface CICVisionThresholdArtifact {
  artifact_type: 'CIC-VISION-THRESHOLD';
  version: string;
  timestamp: string;
  baseline_avg: number;
  structure_avg: number;
  enrichment_delta_avg: number;
  current_threshold: number;
  provider_chain_stats: {
    clip?: ProviderStats;
    blip?: ProviderStats;
    dino?: ProviderStats;
    sam?: ProviderStats;
    googleVision?: ProviderStats;
  };
  update_reason: 'adaptive-update' | 'manual-override' | 'initialization';
  executed_by: string;
  status: 'pending' | 'ratified';
  parent_lineage: string | null;
  hash: string;
}

let versionCounter = 1;

function getNextVersion(): string {
  return `v${String(versionCounter++).padStart(3, '0')}`;
}

function loadVersionCounter(): void {
  if (!fs.existsSync(ARTIFACT_DIR)) {
    fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
    versionCounter = 1;
    return;
  }

  const files = fs.readdirSync(ARTIFACT_DIR);
  const versions = files
    .filter((f) => f.match(/^v\d{3}\.json$/))
    .map((f) => parseInt(f.slice(1, 4), 10));

  if (versions.length > 0) {
    versionCounter = Math.max(...versions) + 1;
  }
}

function computeHash(artifact: Partial<CICVisionThresholdArtifact>): string {
  const toHash = {
    baseline_avg: artifact.baseline_avg,
    structure_avg: artifact.structure_avg,
    enrichment_delta_avg: artifact.enrichment_delta_avg,
    current_threshold: artifact.current_threshold,
    provider_chain_stats: artifact.provider_chain_stats,
    update_reason: artifact.update_reason,
    executed_by: artifact.executed_by,
    parent_lineage: artifact.parent_lineage,
  };

  const json = JSON.stringify(toHash);
  return crypto.createHash('sha256').update(json).digest('hex');
}

export async function writePendingThresholdArtifact(
  state: {
    baselineAvg: number;
    structureAvg: number;
    enrichmentDeltaAvg: number;
    current: number;
    providerStats?: Record<string, ProviderStats>;
    actor: string;
    parentHash?: string;
  },
  reason: 'adaptive-update' | 'manual-override' | 'initialization' = 'adaptive-update'
): Promise<CICVisionThresholdArtifact> {
  loadVersionCounter();

  const version = getNextVersion();
  const timestamp = new Date().toISOString();

  const artifact: CICVisionThresholdArtifact = {
    artifact_type: 'CIC-VISION-THRESHOLD',
    version,
    timestamp,
    baseline_avg: state.baselineAvg,
    structure_avg: state.structureAvg,
    enrichment_delta_avg: state.enrichmentDeltaAvg,
    current_threshold: state.current,
    provider_chain_stats: state.providerStats || {},
    update_reason: reason,
    executed_by: state.actor,
    status: 'pending',
    parent_lineage: state.parentHash || null,
    hash: '', // Will be computed
  };

  // Compute hash
  artifact.hash = computeHash(artifact);

  // Write to file
  if (!fs.existsSync(ARTIFACT_DIR)) {
    fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  }

  const filePath = path.join(ARTIFACT_DIR, `${version}.json`);
  fs.writeFileSync(filePath, JSON.stringify(artifact, null, 2), 'utf-8');

  return artifact;
}

export async function writePendingThresholdArtifactFromVisionAdapter(
  actor: string
): Promise<CICVisionThresholdArtifact> {
  const threshold = getAdaptiveThreshold();

  return writePendingThresholdArtifact(
    {
      baselineAvg: threshold.baselineAvg,
      structureAvg: threshold.structureAvg,
      enrichmentDeltaAvg: threshold.enrichmentDeltaAvg,
      current: threshold.get(),
      actor,
      providerStats: {},
    },
    'adaptive-update'
  );
}

export function loadArtifactByVersion(version: string): CICVisionThresholdArtifact {
  const filePath = path.join(ARTIFACT_DIR, `${version}.json`);

  if (!fs.existsSync(filePath)) {
    throw new Error(`Artifact not found: ${version}`);
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const artifact = JSON.parse(content) as CICVisionThresholdArtifact;

  // Validate schema
  if (artifact.artifact_type !== 'CIC-VISION-THRESHOLD') {
    throw new Error(`Invalid artifact type: ${artifact.artifact_type}`);
  }

  if (!artifact.hash) {
    throw new Error(`Artifact missing hash: ${version}`);
  }

  return artifact;
}

export function getAllArtifacts(): CICVisionThresholdArtifact[] {
  if (!fs.existsSync(ARTIFACT_DIR)) {
    return [];
  }

  const files = fs.readdirSync(ARTIFACT_DIR);
  return files
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      const version = f.replace('.json', '');
      return loadArtifactByVersion(version);
    })
    .sort((a, b) => a.version.localeCompare(b.version));
}

export function getLatestRatifiedArtifact(): CICVisionThresholdArtifact | null {
  const all = getAllArtifacts();
  const ratified = all.filter((a) => a.status === 'ratified');

  if (ratified.length === 0) {
    return null;
  }

  return ratified[ratified.length - 1];
}
