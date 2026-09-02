import { jest } from '@jest/globals';
import { PermissionManager, PermissionConfig, ApprovalCache } from '../src/index';

function freshConfig(overrides: Partial<PermissionConfig> = {}): PermissionConfig {
  return {
    version: '1.0.0',
    lastUpdated: '2026-01-01T00:00:00Z',
    whitelisted: [{ tool: 'git:status', addedAt: '2026-01-01T00:00:00Z', reason: 'safe' }],
    blacklisted: [{ tool: 'rm:rf', addedAt: '2026-01-01T00:00:00Z', reason: 'destructive' }],
    requireApproval: true,
    batchApprovals: true,
    cacheApprovals: true,
    cacheExpiry: 3600000,
    ...overrides,
  };
}

function freshCache(overrides: Partial<ApprovalCache> = {}): ApprovalCache {
  return {
    version: '1.0.0',
    approvals: {},
    stats: { totalRequests: 0, autoApproved: 0, cachedApprovals: 0, manualApprovals: 0 },
    ...overrides,
  };
}

/** Builds a manager with fully controlled in-memory state and no-op persistence,
 *  so tests never touch the real config/cache files on disk. */
function buildManager(configOverrides: Partial<PermissionConfig> = {}, cacheOverrides: Partial<ApprovalCache> = {}): PermissionManager {
  const pm = new PermissionManager();
  (pm as any).config = freshConfig(configOverrides);
  (pm as any).cache = freshCache(cacheOverrides);
  pm.saveConfig = jest.fn();
  pm.saveCache = jest.fn();
  return pm;
}

describe('PermissionGovernor', () => {
  afterEach(() => {
    delete process.env.AUTONOMOUS_EXECUTION;
  });

  describe('permission validation', () => {
    it('auto-approves a whitelisted tool', () => {
      const pm = buildManager();
      const result = pm.checkPermission('read', 'git:status');
      expect(result).toEqual({ requires: false, reason: 'whitelisted', autoApproved: true });
    });

    it('blocks a blacklisted tool', () => {
      const pm = buildManager();
      const result = pm.checkPermission('exec', 'rm:rf');
      expect(result).toEqual({ requires: true, reason: 'blacklisted', blocked: true });
    });

    it('requires approval by default for an unknown tool', () => {
      const pm = buildManager();
      const result = pm.checkPermission('exec', 'unknown:tool');
      expect(result).toEqual({ requires: true, reason: 'default' });
    });

    it('returns a cached approval without re-asking', () => {
      const pm = buildManager({}, {
        approvals: {
          'exec:my-tool': {
            operation: 'exec',
            tool: 'my-tool',
            approved: true,
            reason: 'manual',
            approvedAt: new Date().toISOString(),
          },
        },
      });
      const result = pm.checkPermission('exec', 'my-tool');
      expect(result.requires).toBe(false);
      expect(result.reason).toBe('cached');
      expect(result.cachedAt).toBeDefined();
    });
  });

  describe('role-based access control (whitelist/blacklist matching)', () => {
    it('matches whitelist wildcard patterns', () => {
      const pm = buildManager({
        whitelisted: [{ tool: 'helm:*', addedAt: '2026-01-01T00:00:00Z', reason: 'read-only queries' }],
      });
      expect(pm.isWhitelisted('helm:pri-search')).toBe(true);
      expect(pm.isWhitelisted('other:tool')).toBe(false);
    });

    it('matches blacklist entries exactly', () => {
      const pm = buildManager({
        blacklisted: [{ tool: 'db:drop', addedAt: '2026-01-01T00:00:00Z', reason: 'destructive' }],
      });
      expect(pm.isBlacklisted('db:drop')).toBe(true);
      expect(pm.isBlacklisted('db:read')).toBe(false);
    });

    it('expires a stale cached approval and treats it as uncached', () => {
      const staleTimestamp = new Date(Date.now() - 7200000).toISOString(); // 2 hours ago
      const pm = buildManager({ cacheExpiry: 3600000 }, {
        approvals: {
          'exec:old-tool': {
            operation: 'exec',
            tool: 'old-tool',
            approved: true,
            reason: 'manual',
            approvedAt: staleTimestamp,
          },
        },
      });
      expect(pm.isCached('exec:old-tool')).toBe(false);
      expect((pm as any).cache.approvals['exec:old-tool']).toBeUndefined();
    });
  });

  describe('grant / revoke (whitelist mutation)', () => {
    it('grants access by adding a tool to the whitelist', () => {
      const pm = buildManager({ whitelisted: [] });
      pm.whitelist('new-tool', 'trusted after review');
      expect(pm.isWhitelisted('new-tool')).toBe(true);
      expect(pm.saveConfig).toHaveBeenCalled();
    });

    it('does not duplicate an already-whitelisted tool', () => {
      const pm = buildManager({
        whitelisted: [{ tool: 'git:status', addedAt: '2026-01-01T00:00:00Z', reason: 'safe' }],
      });
      pm.whitelist('git:status', 'safe again');
      expect((pm as any).config.whitelisted).toHaveLength(1);
    });

    it('revokes access by removing a tool from the whitelist', () => {
      const pm = buildManager({
        whitelisted: [{ tool: 'git:status', addedAt: '2026-01-01T00:00:00Z', reason: 'safe' }],
      });
      pm.removeFromWhitelist('git:status');
      expect(pm.isWhitelisted('git:status')).toBe(false);
      expect(pm.saveConfig).toHaveBeenCalled();
    });
  });

  describe('audit trail', () => {
    it('records a manual approval and updates stats', () => {
      const pm = buildManager();
      pm.recordApproval('exec', 'my-tool', true, 'manual');
      const cache = (pm as any).cache as ApprovalCache;
      expect(cache.approvals['exec:my-tool'].approved).toBe(true);
      expect(cache.stats.totalRequests).toBe(1);
      expect(cache.stats.manualApprovals).toBe(1);
      expect(pm.saveCache).toHaveBeenCalled();
    });

    it('returns recent approvals sorted newest-first and respects the limit', () => {
      const pm = buildManager({}, {
        approvals: {
          'a:1': { operation: 'a', tool: '1', approved: true, reason: 'manual', approvedAt: '2026-01-01T00:00:00Z' },
          'b:2': { operation: 'b', tool: '2', approved: true, reason: 'manual', approvedAt: '2026-01-03T00:00:00Z' },
          'c:3': { operation: 'c', tool: '3', approved: true, reason: 'manual', approvedAt: '2026-01-02T00:00:00Z' },
        },
      });
      const recent = pm.getRecentApprovals(2);
      expect(recent).toHaveLength(2);
      expect(recent[0].tool).toBe('2');
      expect(recent[1].tool).toBe('3');
    });

    it('clears the cache and resets stats', () => {
      const pm = buildManager({}, {
        approvals: { 'a:1': { operation: 'a', tool: '1', approved: true, reason: 'manual', approvedAt: '2026-01-01T00:00:00Z' } },
        stats: { totalRequests: 5, autoApproved: 1, cachedApprovals: 2, manualApprovals: 2 },
      });
      pm.clearCache();
      const cache = (pm as any).cache as ApprovalCache;
      expect(cache.approvals).toEqual({});
      expect(cache.stats).toEqual({ totalRequests: 0, autoApproved: 0, cachedApprovals: 0, manualApprovals: 0 });
      expect(pm.saveCache).toHaveBeenCalled();
    });

    it('aggregates bottleneck recommendations for frequently requested tools', () => {
      const pm = buildManager();
      const approvals: ApprovalCache['approvals'] = {};
      for (let i = 0; i < 6; i++) {
        approvals[`exec:${i}`] = {
          operation: 'exec',
          tool: 'hot-tool',
          approved: true,
          reason: 'manual',
          approvedAt: new Date().toISOString(),
        };
      }
      (pm as any).cache.approvals = approvals;
      const { recommendations, topTools } = pm.analyzeBottlenecks();
      expect(topTools[0]).toEqual({ tool: 'hot-tool', count: 6 });
      expect(recommendations[0].tool).toBe('hot-tool');
      expect(recommendations[0].priority).toBe('medium');
    });
  });

  describe('autonomous execution mode', () => {
    it('auto-approves a whitelisted tool without throwing', () => {
      process.env.AUTONOMOUS_EXECUTION = 'true';
      const pm = buildManager();
      const result = pm.checkPermission('read', 'git:status');
      expect(result.requires).toBe(false);
      expect(result.autonomousDecision).toBe(true);
    });

    it('throws for an unknown/risky tool in autonomous mode', () => {
      process.env.AUTONOMOUS_EXECUTION = 'true';
      const pm = buildManager();
      expect(() => pm.checkPermission('exec', 'risky-tool')).toThrow(/Approval blocked/);
    });
  });
});
