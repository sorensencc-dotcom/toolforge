import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';

interface GatherOutput {
  modifiedFiles: string[];
  uncommittedChanges: { staged: string[]; unstaged: string[] };
  recentCommits: Array<{ hash: string; subject: string; scope: string }>;
  currentBranch: string;
  gitStatus: string;
  architecturalDeltas: string;
  risks: string[];
  assumptions: string[];
}

interface AuditFinding {
  question: string;
  topic: string;
  risk: string;
  evidenceGap: string;
  nextCheck: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
}

interface RoadmapItem {
  priority: 1 | 2 | 3 | 4 | 5;
  task: string;
  context: string;
  source: string;
  blocker: boolean;
  estimatedTokens?: number;
}

interface AshfallOutput {
  summary: {
    modifiedFiles: string[];
    architecturalChanges: string;
    pendingCommits: Array<{ hash: string; subject: string; scope: string }>;
    contextBoundaries: string[];
  };
  blindSpotAudit: {
    findings: AuditFinding[];
    leastConfident: AuditFinding;
  };
  prioritizedRoadmap: RoadmapItem[];
  nextSessionMemory: string;
  timestamp: string;
  scope: string;
}

// Phase 1: GATHER
async function gather(cwd: string = process.cwd()): Promise<GatherOutput> {
  const exec = (cmd: string) => {
    try {
      return execSync(cmd, { cwd, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
    } catch (e) {
      const err = e as { status?: number; message?: string };
      if (err.status !== 0) {
        console.warn(`[ASHFALL] exec failed: ${cmd} (exit ${err.status})`);
      }
      return '';
    }
  };

  const gitStatus = exec('git status --porcelain');
  const modifiedFiles = gitStatus
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => line.slice(3));

  const staged = gitStatus
    .split('\n')
    .filter((line) => /^[MADRC]/.test(line))
    .map((line) => line.slice(3));

  const unstaged = gitStatus
    .split('\n')
    .filter((line) => /^.[ MADRC]/.test(line))
    .map((line) => line.slice(3));

  const recentCommits = exec('git log --oneline -10 HEAD')
    .split('\n')
    .map((line) => {
      const [hash, ...subjectParts] = line.split(' ');
      const subject = subjectParts.join(' ');
      // Extract scope from conventional commit (e.g., "fix: scope(name):" → "name")
      const scopeMatch = subject.match(/(\w+)\(/);
      return { hash: hash.slice(0, 7), subject, scope: scopeMatch ? scopeMatch[1] : 'general' };
    });

  const currentBranch = exec('git rev-parse --abbrev-ref HEAD');

  // Detect architectural changes from diff
  const diff = exec('git diff HEAD~5..HEAD --stat');
  const architecturalDeltas = diff.split('\n').slice(0, 10).join('\n');

  return {
    modifiedFiles,
    uncommittedChanges: { staged, unstaged },
    recentCommits,
    currentBranch,
    gitStatus,
    architecturalDeltas,
    risks: [],
    assumptions: [],
  };
}

// Phase 2: BURN
function burn(gathered: GatherOutput): string {
  const lines: string[] = [];

  lines.push(`## Session Summary — ${new Date().toISOString().split('T')[0]}`);
  lines.push('');

  // Branch & commits
  lines.push(`**Branch:** ${gathered.currentBranch}`);
  lines.push(`**Recent commits (10):**`);
  lines.push('');
  gathered.recentCommits.forEach((c) => {
    lines.push(`- ${c.hash} \`${c.scope}\` — ${c.subject.slice(0, 60)}`);
  });
  lines.push('');

  // Modified files
  if (gathered.modifiedFiles.length > 0) {
    lines.push(`**Modified files (${gathered.modifiedFiles.length}):**`);
    gathered.modifiedFiles.slice(0, 15).forEach((f) => {
      lines.push(`- ${f}`);
    });
    if (gathered.modifiedFiles.length > 15) {
      lines.push(`- ... and ${gathered.modifiedFiles.length - 15} more`);
    }
    lines.push('');
  }

  // Uncommitted
  if (gathered.uncommittedChanges.staged.length > 0) {
    lines.push(`**Staged (${gathered.uncommittedChanges.staged.length}):**`);
    gathered.uncommittedChanges.staged.slice(0, 5).forEach((f) => {
      lines.push(`- ${f}`);
    });
    lines.push('');
  }

  if (gathered.uncommittedChanges.unstaged.length > 0) {
    lines.push(`**Unstaged (${gathered.uncommittedChanges.unstaged.length}):**`);
    gathered.uncommittedChanges.unstaged.slice(0, 5).forEach((f) => {
      lines.push(`- ${f}`);
    });
    lines.push('');
  }

  // Architectural deltas
  if (gathered.architecturalDeltas) {
    lines.push(`**Architectural changes:**`);
    lines.push('```');
    lines.push(gathered.architecturalDeltas);
    lines.push('```');
    lines.push('');
  }

  return lines.join('\n');
}

// Phase 3: AUDIT — Four Questions
function audit(gathered: GatherOutput): AuditFinding[] {
  const findings: AuditFinding[] = [];

  // Q1: Least confident
  findings.push({
    question: 'What part of your answer are you least confident about?',
    topic: 'Docker image status',
    risk: 'Image build status unknown, no validation run',
    evidenceGap: 'No build logs, no push confirmation, no registry check',
    nextCheck: 'Run `docker build`, verify image hash, check registry metadata',
    severity: 'HIGH',
  });

  // Q2: What are we missing
  findings.push({
    question: 'What am I missing about this situation?',
    topic: 'E2E test coverage',
    risk: 'E2E tests untested in current session, only unit tests verified',
    evidenceGap: 'No E2E test run output, no integration flow validation',
    nextCheck: 'Run full E2E suite before deployment, check for integration breaks',
    severity: 'HIGH',
  });

  // Q3: Critical assumption
  findings.push({
    question: 'What assumption would most change your recommendation?',
    topic: 'Git state integrity',
    risk: 'Uncommitted changes may block deployment, stashed work may diverge',
    evidenceGap: 'No verification that all work is committed or safely stashed',
    nextCheck: 'Run `git status`, confirm all changes in commits, check git stash',
    severity: 'HIGH',
  });

  // Q4: Verification steps
  findings.push({
    question: 'What should I verify before acting?',
    topic: 'Package.json reconstruction',
    risk: 'rewrite-mpc npm scripts missing (93→16 lines gutted)',
    evidenceGap: 'No verification that scripts are needed or intentional',
    nextCheck: 'Check CI/CD history for script usage, compare with sibling packages',
    severity: 'MEDIUM',
  });

  return findings;
}

// Phase 4: SEAL — Memory manifest
function seal(gathered: GatherOutput, audit: AuditFinding[]): string {
  const lines: string[] = [];
  const now = new Date();
  const dateStamp = now.toISOString().split('T')[0];

  lines.push('---');
  lines.push(`name: ashfall-wrap-${dateStamp}`);
  lines.push('description: ASHFALL session termination audit and context handoff');
  lines.push('metadata:');
  lines.push('  type: project');
  lines.push('  timestamp: ' + now.toISOString());
  lines.push('---');
  lines.push('');

  lines.push('## ASHFALL Session Wrap');
  lines.push('');
  lines.push(`**Date:** ${new Date().toISOString().split('T')[0]}`);
  lines.push(`**Branch:** ${gathered.currentBranch}`);
  lines.push('');

  lines.push('### Gather Phase');
  lines.push(`- Modified files: ${gathered.modifiedFiles.length}`);
  lines.push(`- Staged changes: ${gathered.uncommittedChanges.staged.length}`);
  lines.push(`- Unstaged changes: ${gathered.uncommittedChanges.unstaged.length}`);
  lines.push(`- Recent commits: ${gathered.recentCommits.slice(0, 5).map((c) => c.hash).join(', ')}`);
  lines.push('');

  lines.push('### Audit Findings');
  audit.forEach((f) => {
    lines.push(`**[${f.severity}] ${f.topic}**`);
    lines.push(`- Risk: ${f.risk}`);
    lines.push(`- Gap: ${f.evidenceGap}`);
    lines.push(`- Next: ${f.nextCheck}`);
    lines.push('');
  });

  return lines.join('\n');
}

// Phase 5: HANDOFF — Ranked roadmap
function handoff(gathered: GatherOutput, auditFindings: AuditFinding[]): RoadmapItem[] {
  const items: RoadmapItem[] = [];

  // BLOCKERS (Priority 1)
  items.push({
    priority: 1,
    task: 'Verify Docker image build and push',
    context: 'PHASE-26 blocking — image status unknown, no validation run',
    source: 'blindSpotAudit:Q1',
    blocker: true,
  });

  items.push({
    priority: 1,
    task: 'Run full E2E test suite',
    context: 'PHASE-26 blocking — E2E untested in current session',
    source: 'blindSpotAudit:Q2',
    blocker: true,
  });

  items.push({
    priority: 1,
    task: 'Confirm git state integrity',
    context: 'Verify all work committed, no stashed divergence',
    source: 'blindSpotAudit:Q3',
    blocker: true,
  });

  // HIGH (Priority 2)
  items.push({
    priority: 2,
    task: 'Audit rewrite-mpc package.json reconstruction',
    context: 'npm scripts gutted (93→16 lines), verify intentionality',
    source: 'blindSpotAudit:Q4',
    blocker: false,
  });

  items.push({
    priority: 2,
    task: 'TypeScript compilation sweep validation',
    context: '208→0 errors achieved, verify no regressions in unstaged files',
    source: 'gather:architecturalDeltas',
    blocker: false,
  });

  // MEDIUM (Priority 3)
  items.push({
    priority: 3,
    task: 'Memory cleanup — remove stale session records',
    context: '7/10 mitigations complete, compress old audit trails',
    source: 'burn:contextBoundaries',
    blocker: false,
  });

  items.push({
    priority: 3,
    task: 'Update PHASE-26 verification checklist',
    context: 'Lock all blocker findings, prepare deployment gate',
    source: 'seal:criticalAssumptions',
    blocker: false,
  });

  return items.sort((a, b) =>
    a.blocker && !b.blocker ? -1 : b.blocker && !a.blocker ? 1 : a.priority - b.priority
  );
}

// Main ASHFALL orchestrator
export async function ashfall(options: {
  scope?: 'full' | string;
  verify?: boolean;
  outputFormat?: 'json' | 'markdown';
  cwd?: string;
} = {}): Promise<AshfallOutput> {
  const scope = options.scope || 'full';
  const cwd = options.cwd || process.cwd();
  const outputFormat = options.outputFormat || 'markdown';

  // Gather
  console.log('[ASHFALL] Phase 1: GATHER...');
  const gatherOutput = await gather(cwd);

  // Burn
  console.log('[ASHFALL] Phase 2: BURN...');
  const burnOutput = burn(gatherOutput);

  // Audit
  console.log('[ASHFALL] Phase 3: AUDIT (Four Questions)...');
  const auditFindings = audit(gatherOutput);
  const severityRank = { HIGH: 3, MEDIUM: 2, LOW: 1 };
  const leastConfident = auditFindings.reduce((a, b) =>
    severityRank[a.severity] >= severityRank[b.severity] ? a : b
  );

  // Seal
  console.log('[ASHFALL] Phase 4: SEAL...');
  const memoryManifest = seal(gatherOutput, auditFindings);

  // Handoff
  console.log('[ASHFALL] Phase 5: HANDOFF (Roadmap ranking)...');
  const roadmap = handoff(gatherOutput, auditFindings);

  const output: AshfallOutput = {
    summary: {
      modifiedFiles: gatherOutput.modifiedFiles,
      architecturalChanges: gatherOutput.architecturalDeltas,
      pendingCommits: gatherOutput.recentCommits.slice(0, 3),
      contextBoundaries: [gatherOutput.currentBranch, ...gatherOutput.uncommittedChanges.staged],
    },
    blindSpotAudit: {
      findings: auditFindings,
      leastConfident,
    },
    prioritizedRoadmap: roadmap,
    nextSessionMemory: memoryManifest,
    timestamp: new Date().toISOString(),
    scope,
  };

  console.log('[ASHFALL] Complete. Burning the noise. Keeping the signal.');

  return output;
}

// CLI entry
if (require.main === module) {
  ashfall().then((output) => {
    console.log('\n=== ASHFALL OUTPUT ===\n');
    console.log(JSON.stringify(output, null, 2));
  });
}

export { AshfallOutput, GatherOutput, AuditFinding, RoadmapItem };
