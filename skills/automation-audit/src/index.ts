import * as fs from "fs";
import * as path from "path";

export type Priority = "high" | "medium" | "low";

export interface Opportunity {
  category: "log_rotation" | "backup_management" | "manual_step";
  priority: Priority;
  task: string;
  path: string;
  details: string;
  suggestedFrequency: "weekly" | "monthly";
}

export interface AutomationAuditParams {
  repoRoot?: string;
  logSizeMB?: number;
  backupItemThreshold?: number;
  manualMarkerPattern?: RegExp;
  excludeDirs?: string[];
}

export interface AutomationAuditReport {
  scanTimestamp: string;
  repoRoot: string;
  totalOpportunities: number;
  byPriority: Record<Priority, number>;
  byCategory: Record<string, number>;
  opportunities: Opportunity[];
}

const SCRIPT_EXTENSIONS = new Set([".ps1", ".sh", ".js", ".ts", ".py"]);
const BACKUP_NAME_RE = /^(backup|archive|_archive)/i;

function walk(
  dir: string,
  excludeDirs: Set<string>,
  visit: (entryPath: string, stat: fs.Stats) => void
): void {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.name.startsWith(".git")) continue;
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (excludeDirs.has(entry.name)) continue;
      const stat = fs.statSync(entryPath);
      visit(entryPath, stat);
      walk(entryPath, excludeDirs, visit);
    } else if (entry.isFile()) {
      const stat = fs.statSync(entryPath);
      visit(entryPath, stat);
    }
  }
}

export function runAutomationAudit(params: AutomationAuditParams = {}): AutomationAuditReport {
  const repoRoot = path.resolve(params.repoRoot || process.cwd());
  const logSizeMB = params.logSizeMB ?? 10;
  const backupItemThreshold = params.backupItemThreshold ?? 10;
  const manualMarkerPattern = params.manualMarkerPattern ?? /\b(TODO|manual)\b/i;
  const excludeDirs = new Set(params.excludeDirs ?? ["node_modules", ".git", "dist", "build"]);

  if (!fs.existsSync(repoRoot)) {
    throw Object.assign(new Error(`repoRoot does not exist: ${repoRoot}`), {
      code: "REPO_ROOT_NOT_FOUND",
    });
  }

  const opportunities: Opportunity[] = [];

  walk(repoRoot, excludeDirs, (entryPath, stat) => {
    const relPath = path.relative(repoRoot, entryPath);
    const base = path.basename(entryPath);
    const ext = path.extname(entryPath).toLowerCase();

    if (stat.isFile() && ext === ".log") {
      const sizeMB = stat.size / (1024 * 1024);
      if (sizeMB >= logSizeMB) {
        opportunities.push({
          category: "log_rotation",
          priority: sizeMB >= logSizeMB * 5 ? "high" : "medium",
          task: `Rotate/compress log: ${base}`,
          path: relPath,
          details: `Size: ${sizeMB.toFixed(1)} MB`,
          suggestedFrequency: "weekly",
        });
      }
    }

    if (stat.isDirectory() && BACKUP_NAME_RE.test(base)) {
      let itemCount = 0;
      try {
        itemCount = fs.readdirSync(entryPath).length;
      } catch {
        itemCount = 0;
      }
      if (itemCount > backupItemThreshold) {
        opportunities.push({
          category: "backup_management",
          priority: "medium",
          task: `Automate retention policy for: ${base}`,
          path: relPath,
          details: `Items: ${itemCount}`,
          suggestedFrequency: "weekly",
        });
      }
    }

    if (stat.isFile() && SCRIPT_EXTENSIONS.has(ext)) {
      let content = "";
      try {
        content = fs.readFileSync(entryPath, "utf-8");
      } catch {
        content = "";
      }
      if (manualMarkerPattern.test(content)) {
        opportunities.push({
          category: "manual_step",
          priority: "low",
          task: `Review manual-step marker in: ${base}`,
          path: relPath,
          details: `Matched pattern: ${manualMarkerPattern.source}`,
          suggestedFrequency: "monthly",
        });
      }
    }
  });

  const byPriority: Record<Priority, number> = { high: 0, medium: 0, low: 0 };
  const byCategory: Record<string, number> = {};
  for (const o of opportunities) {
    byPriority[o.priority]++;
    byCategory[o.category] = (byCategory[o.category] || 0) + 1;
  }

  return {
    scanTimestamp: new Date().toISOString(),
    repoRoot,
    totalOpportunities: opportunities.length,
    byPriority,
    byCategory,
    opportunities,
  };
}

if (require.main === module) {
  const report = runAutomationAudit();
  console.log(JSON.stringify(report, null, 2));
}

export default runAutomationAudit;
