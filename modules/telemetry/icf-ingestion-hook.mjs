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

  return {
    source: 'Iron Command Forge (ICF)',
    timestamp,
    overall_status,
    active_worktrees_count: worktrees.length,
    worktrees,
    vault_status: vaultStatus
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

  return baseMetrics;
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

