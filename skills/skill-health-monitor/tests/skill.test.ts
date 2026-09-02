import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { runSkillHealthMonitor } from "../src/index";

function setupFixture(): string {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "skill-health-test-"));
  const skillsDir = path.join(cwd, "toolforge", "skills");
  fs.mkdirSync(path.join(skillsDir, "skill-a"), { recursive: true });
  fs.mkdirSync(path.join(skillsDir, "skill-b"), { recursive: true });
  // skill-c is unregistered: dir exists, no manifest entry
  fs.mkdirSync(path.join(skillsDir, "skill-c"), { recursive: true });

  const manifest = {
    skills: [
      {
        id: "skill-a",
        name: "Skill A",
        timestamps: {
          lastValidation: new Date().toISOString(),
          lastRun: new Date().toISOString(),
        },
      },
      {
        id: "skill-b",
        name: "Skill B",
        timestamps: {
          lastValidation: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
          lastRun: null,
        },
      },
      {
        // orphaned: no skill-d directory
        id: "skill-d",
        name: "Skill D",
        timestamps: { lastValidation: new Date().toISOString(), lastRun: new Date().toISOString() },
      },
    ],
  };
  fs.writeFileSync(
    path.join(cwd, "toolforge", "manifest.json"),
    JSON.stringify(manifest, null, 2)
  );
  return cwd;
}

describe("skill-health-monitor", () => {
  it("throws MANIFEST_NOT_FOUND when manifest is missing", () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "empty-"));
    expect(() => runSkillHealthMonitor({ cwd })).toThrow();
    try {
      runSkillHealthMonitor({ cwd });
    } catch (e) {
      expect((e as { code: string }).code).toBe("MANIFEST_NOT_FOUND");
    }
  });

  it("flags never-run, stale, orphaned, and unregistered skills from real data", () => {
    const cwd = setupFixture();
    const report = runSkillHealthMonitor({ cwd, staleDays: 30 });

    expect(report.totalSkills).toBe(3);
    expect(report.neverRun).toEqual(["skill-b"]);
    expect(report.stale).toEqual(["skill-b"]);
    expect(report.orphanedManifestEntries).toEqual(["skill-d"]);
    expect(report.unregisteredDirs).toEqual(["skill-c"]);
    expect(report.healthScore).toBeLessThan(100);
  });

  it("reports nominal health when manifest and directories agree", () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "skill-health-clean-"));
    const skillsDir = path.join(cwd, "toolforge", "skills");
    fs.mkdirSync(path.join(skillsDir, "clean-skill"), { recursive: true });
    fs.writeFileSync(
      path.join(cwd, "toolforge", "manifest.json"),
      JSON.stringify({
        skills: [
          {
            id: "clean-skill",
            name: "Clean",
            timestamps: {
              lastValidation: new Date().toISOString(),
              lastRun: new Date().toISOString(),
            },
          },
        ],
      })
    );

    const report = runSkillHealthMonitor({ cwd });
    expect(report.healthScore).toBe(100);
    expect(report.recommendations).toEqual([
      "Ecosystem nominal — manifest and directory listing agree, all skills recently validated",
    ]);
  });
});
