export type DefectStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'MUTED';
export type BlastRadiusRating = 'P0' | 'P1' | 'P2' | 'P3' | 'P4';

export interface FailingWorkflow {
  name: string;
  commitSha: string;
  runId?: string;
  job?: string;
  step?: string;
  runner?: string;
  attempt?: number;
}

export interface StructuredOperatorNotes {
  context?: string;
  attemptedFixes?: string[];
  blockedOn?: string;
  rawText?: string;
}

export interface DefectItem {
  id: string;
  signatureHash: string;
  parentHash?: string;
  sourceFingerprint: string;
  status: DefectStatus;
  title: string;
  targetRepo: string;
  failingWorkflows: FailingWorkflow[];
  blastRadius: BlastRadiusRating;
  primarySuspects: string[];
  actionSteps: string[];
  sourceId: string;
  firstSeen: string;
  lastObserved: string;
  lastAction?: string;
  triageOwner?: string;
  tags: string[];
  operatorNotes?: StructuredOperatorNotes;
}

export interface ArchiveIndexEntry {
  id: string;
  signatureHash: string;
  parentHash?: string;
  targetRepo: string;
  blastRadius: BlastRadiusRating;
  firstSeen: string;
  resolvedAt: string;
  durationMs: number;
  archiveFile: string;
  triageOwner?: string;
  tags: string[];
}

export interface SyncOptions {
  dryRun?: boolean;
  maxUnparsedQuarantine?: number;
  queuePath?: string;
  archiveDir?: string;
  offlineBufferDir?: string;
  lockTimeoutMs?: number;
}
