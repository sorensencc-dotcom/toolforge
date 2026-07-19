import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { execFileSync } from "child_process";
import { sessionWrap } from "../src/index";

function initRepo(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "session-wrap-test-"));
  execFileSync("git", ["init"], { cwd: dir });
  execFileSync("git", ["config", "user.email", "test@test.com"], { cwd: dir });
  execFileSync("git", ["config", "user.name", "Test"], { cwd: dir });
  fs.writeFileSync(path.join(dir, "README.md"), "seed\n");
  execFileSync("git", ["add", "."], { cwd: dir });
  execFileSync("git", ["commit", "-m", "seed"], { cwd: dir });
  return dir;
}

describe("session-wrap", () => {
  it("rejects a commit message without a [tool] prefix", async () => {
    const cwd = initRepo();
    await expect(
      sessionWrap({ commitMessage: "no prefix here", cwd })
    ).rejects.toMatchObject({ code: "BAD_COMMIT_PREFIX" });
  });

  it("writes docUpdates and commits only those paths (not git add -A)", async () => {
    const cwd = initRepo();
    // unrelated dirty file that must NOT be staged
    fs.writeFileSync(path.join(cwd, "unrelated.txt"), "dirty\n");

    const result = await sessionWrap({
      commitMessage: "[claude] test wrap",
      docUpdates: [{ path: "NOTES.md", content: "hello\n" }],
      cwd,
    });

    expect(result.success).toBe(true);
    expect(result.commitHash).not.toBeNull();
    expect(result.stagedFiles).toEqual(["NOTES.md"]);
    expect(fs.existsSync(path.join(cwd, "NOTES.md"))).toBe(true);

    const status = execFileSync("git", ["status", "--porcelain"], { cwd, encoding: "utf-8" });
    expect(status).toContain("unrelated.txt"); // still untracked/dirty, not swept in
  });

  it("skips the commit cleanly when nothing is staged", async () => {
    const cwd = initRepo();
    const result = await sessionWrap({ commitMessage: "[claude] noop", cwd });
    expect(result.success).toBe(true);
    expect(result.skippedCommit).toBe(true);
    expect(result.commitHash).toBeNull();
  });

  it("dry-run performs no writes and no git operations", async () => {
    const cwd = initRepo();
    const result = await sessionWrap({
      commitMessage: "[claude] dry",
      docUpdates: [{ path: "DRYRUN.md", content: "x" }],
      dryRun: true,
      cwd,
    });
    expect(result.docUpdates[0].status).toBe("would-write");
    expect(fs.existsSync(path.join(cwd, "DRYRUN.md"))).toBe(false);
    expect(result.commitHash).toBeNull();
  });

  it("stageAll opts into git add -A explicitly", async () => {
    const cwd = initRepo();
    fs.writeFileSync(path.join(cwd, "other.txt"), "included\n");
    const result = await sessionWrap({
      commitMessage: "[human] stage all",
      stageAll: true,
      cwd,
    });
    expect(result.stagedFiles).toContain("other.txt");
  });

  it("exports JSON schema v1.0 with session metrics when provided", async () => {
    const cwd = initRepo();
    const testMetrics = {
      commits: [
        { hash: "abc123", message: "feat: test", files: ["file.ts"], repo: "test-repo" },
        { hash: "def456", message: "fix: bug", files: ["bug.ts", "test.ts"], repo: "test-repo" },
      ],
      skills: [
        { name: "brainstorming", count: 1 },
        { name: "code-review", count: 3 },
      ],
      tokens: 156000,
      model: "haiku",
      durationMinutes: 42,
    };

    const result = await sessionWrap({
      commitMessage: "[claude] test with metrics",
      metrics: testMetrics,
      cwd,
    });

    expect(result.jsonExportPath).toBeDefined();
    expect(result.jsonExportPath).toContain("session-wrap-export.json");

    // Verify JSON file exists and is valid
    if (result.jsonExportPath && fs.existsSync(result.jsonExportPath)) {
      const jsonContent = fs.readFileSync(result.jsonExportPath, "utf-8");
      const parsed = JSON.parse(jsonContent);

      // Verify schema
      expect(parsed.version).toBe("1.0");
      expect(parsed.timestamp).toBeDefined();
      expect(parsed.commits).toHaveLength(2);
      expect(parsed.commits[0]).toEqual({
        hash: "abc123",
        message: "feat: test",
        files: ["file.ts"],
        repo: "test-repo",
      });
      expect(parsed.skills).toHaveLength(2);
      expect(parsed.skills[0]).toEqual({ name: "brainstorming", count: 1 });
      expect(parsed.tokens).toBe(156000);
      expect(parsed.model).toBe("haiku");
      expect(parsed.duration_minutes).toBe(42);
    }
  });

  it("handles missing metrics gracefully", async () => {
    const cwd = initRepo();
    const result = await sessionWrap({
      commitMessage: "[claude] test without metrics",
      cwd,
    });

    expect(result.jsonExportPath).toBeUndefined();
  });
});
