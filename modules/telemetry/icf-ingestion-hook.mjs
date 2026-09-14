import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Collect telemetry envelope for Iron Command Forge (ICF).
 * @param {string} repoRoot - Absolute repository path.
 * @param {string} vaultRoot - Absolute obsidian/vault path.
 * @returns {object} ICF telemetry envelope.
 */
export function collectIcfTelemetry(repoRoot = process.cwd(), vaultRoot = '') {
  const timestamp = new Date().toISOString();
  const effectiveVaultRoot = vaultRoot || path.join(repoRoot, 'obsidian', 'vault');

  // 1. Audit Active Git Worktrees
  let rawWorktrees = '';
  try {
    rawWorktrees = execSync('git worktree list --porcelain', { cwd: repoRoot, encoding: 'utf8' });
  } catch {
    rawWorktrees = '';
  }

  const worktrees = [];
  const entries = rawWorktrees.split('\n\n').filter(Boolean);
  for (const block of entries) {
    const lines = block.split('\n');
    const wtPath = lines.find(l => l.startsWith('worktree '))?.replace('worktree ', '').trim() || '';
    const head = lines.find(l => l.startsWith('HEAD '))?.replace('HEAD ', '').trim() || '';
    const branch = lines.find(l => l.startsWith('branch '))?.replace('branch refs/heads/', '').trim() || 'detached';

    if (wtPath) {
      let isClean = true;
      let dirtyCount = 0;
      try {
        const diff = execSync('git status --porcelain', { cwd: wtPath, encoding: 'utf8' });
        const uncommitted = diff.split('\n').filter(l => l.trim().length > 0);
        dirtyCount = uncommitted.length;
        isClean = dirtyCount === 0;
      } catch {
        isClean = false;
      }

      worktrees.push({ path: wtPath, branch, head: head.slice(0, 8), isClean, dirtyCount });
    }
  }

  // 2. Vault Synchronization & WAL Status
  const vaultStagingDir = path.join(effectiveVaultRoot, '_kb-sync-staging');
  const repoStagingDir = path.join(repoRoot, '_kb-sync-staging');
  const activeStagingDir = fs.existsSync(vaultStagingDir) ? vaultStagingDir : (fs.existsSync(repoStagingDir) ? repoStagingDir : null);

  const lockFile = path.join(repoRoot, '.serial-merge.lock');
  const recoveryManifest = path.join(repoRoot, '.recovery-manifest.json');

  let stagedBatches = 0;
  if (activeStagingDir && fs.existsSync(activeStagingDir)) {
    try {
      stagedBatches = fs.readdirSync(activeStagingDir).length;
    } catch {
      stagedBatches = 0;
    }
  }

  const vaultStatus = {
    vault_initialized: fs.existsSync(effectiveVaultRoot) || fs.existsSync(path.join(repoRoot, 'wiki')),
    staging_active: activeStagingDir !== null,
    staged_batches: stagedBatches,
    concurrency_locked: fs.existsSync(lockFile),
    recovery_pending: fs.existsSync(recoveryManifest)
  };

  const isClean = (worktrees.length === 0 || worktrees.every(w => w.isClean)) &&
    !vaultStatus.recovery_pending &&
    !vaultStatus.concurrency_locked;

  const overall_status = isClean ? 'CLEAN' : 'DEGRADED';

  const graft = collectGraftTelemetry(repoRoot);
  const upstreamDrift = collectUpstreamDriftTelemetry(repoRoot);
  const partitionHeadroom = collectPartitionHeadroomTelemetry(repoRoot);

  return {
    source: 'Iron Command Forge (ICF)',
    timestamp,
    overall_status,
    active_worktrees_count: worktrees.length,
    worktrees,
    vault_status: vaultStatus,
    graft,
    upstream_drift: upstreamDrift,
    partition_headroom: partitionHeadroom,
  };
}

/**
 * Format ICF telemetry as Prometheus exposition text.
 * @param {object} telemetry - Telemetry payload from collectIcfTelemetry.
 * @returns {string} Prometheus metrics text.
 */
export function formatPrometheusMetrics(telemetry) {
  const dirtyWorktrees = telemetry.worktrees.filter(w => !w.isClean).length;
  const isCleanVal = telemetry.overall_status === 'CLEAN' ? 1 : 0;
  const isLockedVal = telemetry.vault_status.concurrency_locked ? 1 : 0;
  const isRecoveryVal = telemetry.vault_status.recovery_pending ? 1 : 0;
  const stagingActiveVal = telemetry.vault_status.staging_active ? 1 : 0;

  let baseMetrics = `# HELP icf_worktrees_active Number of active git worktrees monitored by ICF
# TYPE icf_worktrees_active gauge
icf_worktrees_active ${telemetry.active_worktrees_count}

# HELP icf_worktrees_dirty Number of uncommitted or dirty git worktrees
# TYPE icf_worktrees_dirty gauge
icf_worktrees_dirty ${dirtyWorktrees}

# HELP icf_vault_staging_active Whether vault staging directory is active
# TYPE icf_vault_staging_active gauge
icf_vault_staging_active ${stagingActiveVal}

# HELP icf_vault_staged_batches Count of pending sync batches in staging
# TYPE icf_vault_staged_batches gauge
icf_vault_staged_batches ${telemetry.vault_status.staged_batches}

# HELP icf_vault_concurrency_locked Whether serial merge queue lock is active
# TYPE icf_vault_concurrency_locked gauge
icf_vault_concurrency_locked ${isLockedVal}

# HELP icf_vault_recovery_pending Whether WAL recovery manifest is pending
# TYPE icf_vault_recovery_pending gauge
icf_vault_recovery_pending ${isRecoveryVal}

# HELP icf_status_clean ICF gate health status (1 = CLEAN, 0 = DEGRADED)
# TYPE icf_status_clean gauge
icf_status_clean ${isCleanVal}
`;

  if (telemetry.headroom) {
    const hrOnline = telemetry.headroom.online ? 1 : 0;
    const hrTokensSaved = telemetry.headroom.tokens_saved || 0;
    const hrHitRate = telemetry.headroom.hit_rate || 0;
    const hrCostSaved = telemetry.headroom.cost_savings_usd || 0;

    baseMetrics += `
# HELP icf_headroom_online Headroom proxy connectivity status (1 = ONLINE, 0 = OFFLINE)
# TYPE icf_headroom_online gauge
icf_headroom_online ${hrOnline}

# HELP icf_headroom_tokens_saved_total Total prompt tokens saved by Headroom compression
# TYPE icf_headroom_tokens_saved_total counter
icf_headroom_tokens_saved_total ${hrTokensSaved}

# HELP icf_headroom_cache_hit_rate_pct Prefix cache hit percentage reported by Headroom
# TYPE icf_headroom_cache_hit_rate_pct gauge
icf_headroom_cache_hit_rate_pct ${hrHitRate}

# HELP icf_headroom_cost_avoided_usd Estimated API cost avoided via Headroom in USD
# TYPE icf_headroom_cost_avoided_usd gauge
icf_headroom_cost_avoided_usd ${hrCostSaved}
`;
  }

  if (telemetry.graft) {
    const graftActive = telemetry.graft.active ? 1 : 0;
    const graftTokensSaved = telemetry.graft.tokens_saved_total || 0;
    const graftReductionPct = telemetry.graft.reduction_pct || 0;
    const graftCostAvoided = telemetry.graft.cost_avoided_usd || 0;

    baseMetrics += `
# HELP icf_graft_active Whether Graft context graph engine is active
# TYPE icf_graft_active gauge
icf_graft_active ${graftActive}

# HELP icf_graft_tokens_saved_total Total prompt tokens saved by Graft graph pruning
# TYPE icf_graft_tokens_saved_total counter
icf_graft_tokens_saved_total ${graftTokensSaved}

# HELP icf_graft_reduction_pct Percentage token reduction achieved by graph crux resolution
# TYPE icf_graft_reduction_pct gauge
icf_graft_reduction_pct ${graftReductionPct}

# HELP icf_graft_cost_avoided_usd Estimated API cost avoided via Graft in USD
# TYPE icf_graft_cost_avoided_usd gauge
icf_graft_cost_avoided_usd ${graftCostAvoided}
`;
  }

  if (telemetry.upstream_drift) {
    const driftWatchers = telemetry.upstream_drift.active_watchers || 0;
    const driftPending = telemetry.upstream_drift.pending_approvals || 0;
    const driftUnresolved = telemetry.upstream_drift.unresolved_count || 0;

    baseMetrics += `
# HELP icf_upstream_drift_active_watchers Active upstream drift watchdog monitors
# TYPE icf_upstream_drift_active_watchers gauge
icf_upstream_drift_active_watchers ${driftWatchers}

# HELP icf_upstream_drift_pending_approvals Count of unapproved Sigil drift envelopes
# TYPE icf_upstream_drift_pending_approvals gauge
icf_upstream_drift_pending_approvals ${driftPending}

# HELP icf_upstream_drift_unresolved_count Total unmerged upstream drift events
# TYPE icf_upstream_drift_unresolved_count gauge
icf_upstream_drift_unresolved_count ${driftUnresolved}
`;
  }

  if (telemetry.partition_headroom && telemetry.partition_headroom.partitions) {
    baseMetrics += `
# HELP icf_notebook_partition_tokens Estimated token load per partitioned knowledge notebook
# TYPE icf_notebook_partition_tokens gauge
`;
    for (const [key, part] of Object.entries(telemetry.partition_headroom.partitions)) {
      baseMetrics += `icf_notebook_partition_tokens{partition="${key}",target="${part.target_id || ''}"} ${part.estimated_tokens}\n`;
    }

    baseMetrics += `
# HELP icf_notebook_partition_headroom_pct Remaining headroom percentage before partition context saturation
# TYPE icf_notebook_partition_headroom_pct gauge
`;
    for (const [key, part] of Object.entries(telemetry.partition_headroom.partitions)) {
      baseMetrics += `icf_notebook_partition_headroom_pct{partition="${key}"} ${part.headroom_pct}\n`;
    }
  }

  return baseMetrics;
}

/**
 * Collect token counts and context headroom for partitioned notebooks.
 * @param {string} repoRoot - Absolute repository path.
 * @returns {object} Partition headroom summary.
 */
export function collectPartitionHeadroomTelemetry(repoRoot = process.cwd()) {
  const nlmPackDir = path.join(repoRoot, '.nlm_pack');
  const MAX_PARTITION_TOKENS = 500000; // Standard context ceiling per thematic notebook partition

  const partitionDefs = {
    'ironledger': { file: 'pack_ironledger.txt', target_id: '76e1932c-054a-4520-9e83-5e882dffc938' },
    'sigil': { file: 'pack_sigil.txt', target_id: '26eacb85-2c97-443d-9d81-3bd99cc98412' },
    'miami-estate': { file: 'pack_miami_estate.txt', target_id: '64949154-5892-4fa4-9ad0-e48b2bf5cc6c' },
    'assembly-line': { file: 'pack_assembly_line.txt', target_id: '70be0df3-c58a-4711-b4d3-1e4b8726faf7' },
    'agent-harness': { file: 'pack_agent_harness.txt', target_id: '359b346c-6af7-4ba3-baef-b985c9e6e1af' },
    'personal-os': { file: 'pack_personal_os.txt', target_id: '9724e682-c5ea-4693-8e21-caf8de68611e' },
    'willow-run': { file: 'pack_willow_run.txt', target_id: '6fd7c40b-df90-444b-9c7a-a64682925856' },
    'master-kb': { file: 'pack_master_kb.txt', target_id: '679b8bab-2d87-42cb-a726-6dc54c83acc2' }
  };

  const partitions = {};
  let totalEstimatedTokens = 0;

  for (const [key, def] of Object.entries(partitionDefs)) {
    const packPath = path.join(nlmPackDir, def.file);
    let sizeBytes = 0;
    if (fs.existsSync(packPath)) {
      try {
        sizeBytes = fs.statSync(packPath).size;
      } catch {
        sizeBytes = 0;
      }
    }
    // Estimated ~4 chars per token
    const estimatedTokens = Math.ceil(sizeBytes / 4);
    totalEstimatedTokens += estimatedTokens;
    const headroomPct = Math.max(0, Math.min(100, Number(((1 - (estimatedTokens / MAX_PARTITION_TOKENS)) * 100).toFixed(2))));

    partitions[key] = {
      filename: def.file,
      target_id: def.target_id,
      size_bytes: sizeBytes,
      estimated_tokens: estimatedTokens,
      max_budget_tokens: MAX_PARTITION_TOKENS,
      headroom_pct: headroomPct,
      status: headroomPct > 15 ? 'NOMINAL' : 'SATURATION_RISK'
    };
  }

  return {
    ceiling_tokens_per_partition: MAX_PARTITION_TOKENS,
    total_tokens_across_partitions: totalEstimatedTokens,
    partitions
  };
}

/**
 * Fetch live metrics from Headroom proxy.
 * @param {number} port - Proxy port (default 8787).
 * @returns {Promise<object>} Headroom summary metrics.
 */
export async function fetchHeadroomMetrics(port = 8787) {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/stats`, { signal: AbortSignal.timeout(1500) });
    if (!res.ok) return { online: false };
    const stats = await res.json();
    return {
      online: true,
      tokens_saved: (stats.cost && stats.cost.total_tokens_saved) || (stats.tokens && stats.tokens.tokens_saved) || 0,
      savings_percent: (stats.cost && stats.cost.reduction_pct) || (stats.tokens && stats.tokens.savings_percent) || 0,
      cost_savings_usd: (stats.cost && (stats.cost.savings_usd || stats.cost.compression_savings_usd)) || 0,
      hit_rate: (stats.prefix_cache && stats.prefix_cache.totals && stats.prefix_cache.totals.hit_rate) || 0
    };
  } catch {
    return { online: false };
  }
}

/**
 * Collect Graft context graph status and telemetry.
 * @param {string} repoRoot - Absolute repository path.
 * @returns {object} Graft telemetry summary.
 */
export function collectGraftTelemetry(repoRoot = process.cwd()) {
  const graftDir = path.join(repoRoot, 'graft');
  const indexFile = path.join(graftDir, 'INDEX.md');
  const hasGraft = fs.existsSync(graftDir) && fs.existsSync(indexFile);

  return {
    active: hasGraft,
    tokens_saved_total: 0,
    reduction_pct: 0,
    cost_avoided_usd: 0,
  };
}

/**
 * Collect upstream competitor drift telemetry.
 * @param {string} repoRoot - Absolute repository path.
 * @returns {object} Upstream drift summary.
 */
export function collectUpstreamDriftTelemetry(repoRoot = process.cwd()) {
  const sigilQueuePath = path.join(repoRoot, '.sigil', 'sigil-queue.jsonl');
  let pendingCount = 0;
  if (fs.existsSync(sigilQueuePath)) {
    try {
      const lines = fs.readFileSync(sigilQueuePath, 'utf8').split('\n').filter(Boolean);
      pendingCount = lines.filter(l => l.includes('task.step_up_request')).length;
    } catch {
      pendingCount = 0;
    }
  }

  return {
    active_watchers: 3,
    pending_approvals: pendingCount,
    unresolved_count: pendingCount,
  };
}

/**
 * Write Prometheus metrics file to destination path.
 * @param {object} telemetry - Telemetry payload.
 * @param {string} promPath - Output file path.
 */
export function writePrometheusMetrics(telemetry, promPath) {
  const content = formatPrometheusMetrics(telemetry);
  const dir = path.dirname(promPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(promPath, content, 'utf8');
}

