import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { runAutomationAudit } from "../src/index";

function setupFixture(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "automation-audit-test-"));

  // oversized log
  fs.writeFileSync(path.join(root, "big.log"), Buffer.alloc(11 * 1024 * 1024));
  // small log, should not trigger
  fs.writeFileSync(path.join(root, "small.log"), Buffer.alloc(1024));

  // backup dir with many items
  const backupDir = path.join(root, "backup_2026");
  fs.mkdirSync(backupDir);
  for (let i = 0; i < 15; i++) {
    fs.writeFileSync(path.join(backupDir, `item-${i}.dat`), "x");
  }

  // script with manual marker
  fs.writeFileSync(path.join(root, "deploy.ps1"), "# TODO: automate this manual step\n");
  // script without marker
  fs.writeFileSync(path.join(root, "clean.ps1"), "Write-Host 'ok'\n");

  // excluded dir should be skipped entirely
  const nm = path.join(root, "node_modules", "pkg");
  fs.mkdirSync(nm, { recursive: true });
  fs.writeFileSync(path.join(nm, "huge.log"), Buffer.alloc(20 * 1024 * 1024));

  return root;
}

describe("automation-audit", () => {
  it("throws REPO_ROOT_NOT_FOUND for a missing path", () => {
    expect(() => runAutomationAudit({ repoRoot: "/definitely/not/real/path" })).toThrow();
  });

  it("flags oversized log, backup dir, and manual-step script; skips excluded dirs", () => {
    const root = setupFixture();
    const report = runAutomationAudit({ repoRoot: root, logSizeMB: 10, backupItemThreshold: 10 });

    const categories = report.opportunities.map((o) => o.category);
    expect(categories).toContain("log_rotation");
    expect(categories).toContain("backup_management");
    expect(categories).toContain("manual_step");

    const logPaths = report.opportunities
      .filter((o) => o.category === "log_rotation")
      .map((o) => o.path);
    expect(logPaths).toContain("big.log");
    expect(logPaths).not.toContain("small.log");
    expect(logPaths.some((p) => p.includes("node_modules"))).toBe(false);

    expect(report.byCategory.log_rotation).toBe(1);
    expect(report.totalOpportunities).toBe(report.opportunities.length);
  });

  it("marks a very oversized log as high priority", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "automation-audit-hi-"));
    fs.writeFileSync(path.join(root, "huge.log"), Buffer.alloc(60 * 1024 * 1024));
    const report = runAutomationAudit({ repoRoot: root, logSizeMB: 10 });
    expect(report.opportunities[0].priority).toBe("high");
  });
});
