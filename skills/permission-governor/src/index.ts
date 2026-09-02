/**
 * Permission Management System
 *
 * Solves approval friction by:
 * 1. Whitelisting safe/trusted operations (auto-approve)
 * 2. Caching approval decisions (don't re-ask)
 * 3. Batching approval requests (approve multiple at once)
 * 4. Tracking approval sources (where are the bottlenecks?)
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PERMISSION_CONFIG = path.join(__dirname, "permission-config.json");
const APPROVAL_CACHE = path.join(__dirname, "approval-cache.json");

export interface PermissionCheckResult {
  requires: boolean;
  reason: string;
  autoApproved?: boolean;
  blocked?: boolean;
  cachedAt?: string;
  autonomousDecision?: boolean;
}

export interface WhitelistEntry {
  tool: string;
  addedAt: string;
  reason: string;
}

export interface BlacklistEntry {
  tool: string;
  addedAt: string;
  reason: string;
}

export interface PermissionConfig {
  version: string;
  lastUpdated: string;
  whitelisted: WhitelistEntry[];
  blacklisted: BlacklistEntry[];
  requireApproval: boolean;
  batchApprovals: boolean;
  cacheApprovals: boolean;
  cacheExpiry: number;
}

export interface ApprovalCache {
  version: string;
  approvals: Record<string, {
    operation: string;
    tool: string;
    approved: boolean;
    reason: string;
    approvedAt: string;
  }>;
  stats: {
    totalRequests: number;
    autoApproved: number;
    cachedApprovals: number;
    manualApprovals: number;
  };
}

export class PermissionManager {
  private config: PermissionConfig;
  private cache: ApprovalCache;

  constructor() {
    this.config = this.loadConfig();
    this.cache = this.loadCache();
  }

  loadConfig(): PermissionConfig {
    try {
      if (fs.existsSync(PERMISSION_CONFIG)) {
        const loaded = JSON.parse(fs.readFileSync(PERMISSION_CONFIG, "utf-8"));
        return {
          version: loaded.version || "1.0.0",
          lastUpdated: loaded.lastUpdated || new Date().toISOString(),
          whitelisted: loaded.whitelisted || [],
          blacklisted: loaded.blacklisted || [],
          requireApproval: loaded.config?.requireApproval ?? loaded.requireApproval ?? true,
          batchApprovals: loaded.config?.batchApprovals ?? loaded.batchApprovals ?? true,
          cacheApprovals: loaded.config?.cacheApprovals ?? loaded.cacheApprovals ?? true,
          cacheExpiry: loaded.config?.cacheExpiry ?? loaded.cacheExpiry ?? 3600000,
        };
      }
    } catch (e: any) {
      console.warn(`⚠ Failed to load permission config: ${e.message}`);
    }

    return {
      version: "1.0.0",
      lastUpdated: new Date().toISOString(),
      whitelisted: [],
      blacklisted: [],
      requireApproval: true,
      batchApprovals: true,
      cacheApprovals: true,
      cacheExpiry: 3600000, // 1 hour
    };
  }

  loadCache(): ApprovalCache {
    try {
      if (fs.existsSync(APPROVAL_CACHE)) {
        return JSON.parse(fs.readFileSync(APPROVAL_CACHE, "utf-8"));
      }
    } catch (e: any) {
      console.warn(`⚠ Failed to load approval cache: ${e.message}`);
    }

    return {
      version: "1.0.0",
      approvals: {},
      stats: {
        totalRequests: 0,
        autoApproved: 0,
        cachedApprovals: 0,
        manualApprovals: 0,
      },
    };
  }

  saveConfig(): void {
    try {
      fs.writeFileSync(
        PERMISSION_CONFIG,
        JSON.stringify(this.config, null, 2),
        "utf-8"
      );
    } catch (e: any) {
      console.error(`✗ Failed to save config: ${e.message}`);
    }
  }

  saveCache(): void {
    try {
      fs.writeFileSync(
        APPROVAL_CACHE,
        JSON.stringify(this.cache, null, 2),
        "utf-8"
      );
    } catch (e: any) {
      console.error(`✗ Failed to save cache: ${e.message}`);
    }
  }

  checkPermission(operation: string, tool: string, args: any = {}): PermissionCheckResult {
    if (process.env.AUTONOMOUS_EXECUTION === 'true') {
      const autonomous = this.autoDecideAutonomous(operation, tool, args);
      if (autonomous.approved) {
        return {
          requires: false,
          reason: "autonomous:auto-approved",
          autonomousDecision: true,
        };
      } else {
        throw new Error(
          `[AUTONOMOUS MODE] Approval blocked: ${tool}:${operation}\n` +
          `Reason: unknown or risky operation\n\n` +
          `To proceed:\n` +
          `1. Add to whitelist: pm.whitelist('${tool}')\n` +
          `2. Exit autonomous mode and approve manually\n` +
          `3. Run outside autonomous context\n`
        );
      }
    }

    if (this.isWhitelisted(tool)) {
      return {
        requires: false,
        reason: "whitelisted",
        autoApproved: true,
      };
    }

    if (this.isBlacklisted(tool)) {
      return {
        requires: true,
        reason: "blacklisted",
        blocked: true,
      };
    }

    const cacheKey = this.getCacheKey(operation, tool);
    if (this.isCached(cacheKey)) {
      return {
        requires: false,
        reason: "cached",
        cachedAt: this.cache.approvals[cacheKey].approvedAt,
      };
    }

    return {
      requires: true,
      reason: "default",
    };
  }

  getCacheKey(operation: string, tool: string): string {
    return `${operation}:${tool}`;
  }

  isWhitelisted(tool: string): boolean {
    return this.config.whitelisted.some((t: any) => {
      const whitelistEntry = typeof t === "string" ? t : t.tool;
      if (whitelistEntry === tool) return true;
      if (whitelistEntry.endsWith("*")) {
        const pattern = whitelistEntry.slice(0, -1);
        return tool.startsWith(pattern);
      }
      return false;
    });
  }

  isBlacklisted(tool: string): boolean {
    return this.config.blacklisted.some((t: any) =>
      typeof t === "string" ? t === tool : t.tool === tool
    );
  }

  isCached(cacheKey: string): boolean {
    if (!this.config.cacheApprovals) return false;

    const approval = this.cache.approvals[cacheKey];
    if (!approval) return false;

    const age = Date.now() - new Date(approval.approvedAt).getTime();
    if (age > this.config.cacheExpiry) {
      delete this.cache.approvals[cacheKey];
      return false;
    }

    return true;
  }

  recordApproval(operation: string, tool: string, approved: boolean = true, reason: string = "manual"): void {
    const cacheKey = this.getCacheKey(operation, tool);

    this.cache.approvals[cacheKey] = {
      operation,
      tool,
      approved,
      reason,
      approvedAt: new Date().toISOString(),
    };

    this.cache.stats.totalRequests++;
    if (reason === "whitelisted") this.cache.stats.autoApproved++;
    if (reason === "cached") this.cache.stats.cachedApprovals++;
    if (reason === "manual") this.cache.stats.manualApprovals++;

    this.saveCache();
  }

  whitelist(tool: string, reason: string = ""): void {
    const exists = this.config.whitelisted.some((t: any) => 
      (typeof t === "string" ? t : t.tool) === tool
    );
    if (!exists) {
      this.config.whitelisted.push({
        tool,
        addedAt: new Date().toISOString(),
        reason,
      });
      this.saveConfig();
    }
  }

  removeFromWhitelist(tool: string): void {
    this.config.whitelisted = this.config.whitelisted.filter(
      (t: any) => (typeof t === "string" ? t : t.tool) !== tool
    );
    this.saveConfig();
  }

  getSummary(): any {
    return {
      config: {
        whitelistCount: this.config.whitelisted.length,
        blacklistCount: this.config.blacklisted.length,
        cacheEnabled: this.config.cacheApprovals,
        cacheExpiry: this.config.cacheExpiry,
      },
      stats: this.cache.stats,
      cacheSize: Object.keys(this.cache.approvals).length,
      autoApprovalRate: (
        ((this.cache.stats.autoApproved / Math.max(1, this.cache.stats.totalRequests)) *
          100).toFixed(1) + "%"
      ),
      cachedApprovalRate: (
        ((this.cache.stats.cachedApprovals / Math.max(1, this.cache.stats.totalRequests)) *
          100).toFixed(1) + "%"
      ),
    };
  }

  getRecentApprovals(limit: number = 20): any[] {
    return Object.values(this.cache.approvals)
      .sort(
        (a: any, b: any) =>
          new Date(b.approvedAt).getTime() - new Date(a.approvedAt).getTime()
      )
      .slice(0, limit);
  }

  analyzeBottlenecks(): any {
    const approvals = Object.values(this.cache.approvals);
    const byTool: Record<string, number> = {};
    const byOperation: Record<string, number> = {};

    for (const approval of approvals) {
      byTool[approval.tool] = (byTool[approval.tool] || 0) + 1;
      byOperation[approval.operation] =
        (byOperation[approval.operation] || 0) + 1;
    }

    return {
      topTools: Object.entries(byTool)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([tool, count]) => ({ tool, count })),
      topOperations: Object.entries(byOperation)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([operation, count]) => ({ operation, count })),
      recommendations: this.generateRecommendations(byTool),
    };
  }

  generateRecommendations(byTool: Record<string, number>): any[] {
    const recommendations = [];

    for (const [tool, count] of Object.entries(byTool)) {
      if (count >= 5) {
        recommendations.push({
          tool,
          count,
          recommendation: `Whitelist ${tool} (requested ${count}+ times)`,
          priority: count >= 20 ? "high" : "medium",
        });
      }
    }

    return recommendations.sort((a, b) => b.count - a.count);
  }

  clearCache(): void {
    this.cache.approvals = {};
    this.cache.stats = {
      totalRequests: 0,
      autoApproved: 0,
      cachedApprovals: 0,
      manualApprovals: 0,
    };
    this.saveCache();
  }

  autoDecideAutonomous(operation: string, tool: string, args: any = {}): { approved: boolean; reason: string; autonomousDecision: boolean } {
    if (this.isWhitelisted(tool)) {
      return {
        approved: true,
        reason: "whitelisted",
        autonomousDecision: true,
      };
    }

    const cacheKey = this.getCacheKey(operation, tool);
    if (this.isCached(cacheKey)) {
      return {
        approved: true,
        reason: "cached",
        autonomousDecision: true,
      };
    }

    return {
      approved: false,
      reason: "unknown-operation",
      autonomousDecision: true,
    };
  }
}
