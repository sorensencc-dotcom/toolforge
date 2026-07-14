import { validateSubmission } from "../src/validate";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

describe("Submission Validator", () => {
  let testDir: string;

  beforeEach(() => {
    // Create temp test directory
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), "validator-test-"));
  });

  afterEach(() => {
    // Clean up
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  it("rejects skill with missing SKILL.json", () => {
    const report = validateSubmission(testDir);
    expect(report.checks.manifest_valid).toBe(false);
    expect(report.blockers.length).toBeGreaterThan(0);
    expect(report.recommendation).toBe("reject");
  });

  it("rejects skill with invalid SKILL.json", () => {
    fs.writeFileSync(path.join(testDir, "SKILL.json"), "{ invalid json");
    const report = validateSubmission(testDir);
    expect(report.checks.manifest_valid).toBe(false);
    expect(report.recommendation).toBe("reject");
  });

  it("validates manifest required fields", () => {
    const manifest = {
      name: "Test Skill",
      // Missing: id, version, status, category, runtime, entrypoint, owner
    };
    fs.writeFileSync(
      path.join(testDir, "SKILL.json"),
      JSON.stringify(manifest)
    );
    const report = validateSubmission(testDir);
    expect(report.checks.manifest_valid).toBe(false);
    expect(report.blockers.length).toBeGreaterThan(0);
  });

  it("validates manifest id pattern", () => {
    const manifest = {
      id: "Invalid ID", // Should be kebab-case
      name: "Test Skill",
      version: "1.0.0",
      status: "active",
      category: "utility",
      runtime: "node",
      entrypoint: "src/index.ts",
      owner: "soren",
    };
    fs.writeFileSync(
      path.join(testDir, "SKILL.json"),
      JSON.stringify(manifest)
    );
    const report = validateSubmission(testDir);
    expect(report.checks.manifest_valid).toBe(false);
  });

  it("validates manifest version semver", () => {
    const manifest = {
      id: "test-skill",
      name: "Test Skill",
      version: "1.0", // Missing patch
      status: "active",
      category: "utility",
      runtime: "node",
      entrypoint: "src/index.ts",
      owner: "soren",
    };
    fs.writeFileSync(
      path.join(testDir, "SKILL.json"),
      JSON.stringify(manifest)
    );
    const report = validateSubmission(testDir);
    expect(report.checks.manifest_valid).toBe(false);
  });

  it("accepts valid manifest", () => {
    const manifest = {
      id: "test-skill",
      name: "Test Skill",
      version: "1.0.0",
      status: "active",
      category: "utility",
      runtime: "node",
      entrypoint: "src/index.ts",
      owner: "soren",
      permissions: {
        required: ["file.read"],
        optional: [],
      },
    };
    fs.writeFileSync(
      path.join(testDir, "SKILL.json"),
      JSON.stringify(manifest)
    );
    const report = validateSubmission(testDir);
    expect(report.checks.manifest_valid).toBe(true);
    expect(report.skill_id).toBe("test-skill");
    expect(report.skill_version).toBe("1.0.0");
  });

  it("detects missing documentation", () => {
    const manifest = {
      id: "test-skill",
      name: "Test Skill",
      version: "1.0.0",
      status: "active",
      category: "utility",
      runtime: "node",
      entrypoint: "src/index.ts",
      owner: "soren",
    };
    fs.writeFileSync(
      path.join(testDir, "SKILL.json"),
      JSON.stringify(manifest)
    );
    const report = validateSubmission(testDir);
    expect(report.checks.docs_complete).toBe(false);
    expect(report.blockers.some((b) => b.includes("Documentation"))).toBe(true);
  });

  it("accepts skill with README.md", () => {
    const manifest = {
      id: "test-skill",
      name: "Test Skill",
      version: "1.0.0",
      status: "active",
      category: "utility",
      runtime: "node",
      entrypoint: "src/index.ts",
      owner: "soren",
    };
    fs.writeFileSync(
      path.join(testDir, "SKILL.json"),
      JSON.stringify(manifest)
    );

    const readmeContent = `
# Test Skill

## Purpose
This is a test skill.

## Usage
Use it like this.

## Permissions
Requires file.read.
`;
    fs.writeFileSync(path.join(testDir, "README.md"), readmeContent);

    const report = validateSubmission(testDir);
    expect(report.checks.docs_complete).toBe(true);
  });

  it("checks governance: naming convention", () => {
    const manifest = {
      id: "invalidid", // Missing hyphen
      name: "Test Skill",
      version: "1.0.0",
      status: "active",
      category: "utility",
      runtime: "node",
      entrypoint: "src/index.ts",
      owner: "soren",
    };
    fs.writeFileSync(
      path.join(testDir, "SKILL.json"),
      JSON.stringify(manifest)
    );
    const report = validateSubmission(testDir);
    expect(report.checks.governance_aligned).toBe(false);
  });

  it("checks governance: owner required", () => {
    const manifest = {
      id: "test-skill",
      name: "Test Skill",
      version: "1.0.0",
      status: "active",
      category: "utility",
      runtime: "node",
      entrypoint: "src/index.ts",
      owner: "", // Empty owner
    };
    fs.writeFileSync(
      path.join(testDir, "SKILL.json"),
      JSON.stringify(manifest)
    );
    const report = validateSubmission(testDir);
    expect(report.checks.governance_aligned).toBe(false);
  });

  it("detects unsafe code (eval)", () => {
    const manifest = {
      id: "test-skill",
      name: "Test Skill",
      version: "1.0.0",
      status: "active",
      category: "utility",
      runtime: "node",
      entrypoint: "src/index.ts",
      owner: "soren",
    };
    fs.writeFileSync(
      path.join(testDir, "SKILL.json"),
      JSON.stringify(manifest)
    );

    fs.mkdirSync(path.join(testDir, "src"));
    const unsafeCode = `
function test() {
  eval("dangerous code");
}
`;
    fs.writeFileSync(path.join(testDir, "src", "unsafe.ts"), unsafeCode);

    const report = validateSubmission(testDir);
    expect(report.checks.governance_aligned).toBe(false);
  });

  it("returns correct submission_id format", () => {
    const manifest = {
      id: "test-skill",
      name: "Test Skill",
      version: "1.0.0",
      status: "active",
      category: "utility",
      runtime: "node",
      entrypoint: "src/index.ts",
      owner: "soren",
    };
    fs.writeFileSync(
      path.join(testDir, "SKILL.json"),
      JSON.stringify(manifest)
    );

    const report = validateSubmission(testDir);
    expect(report.submission_id).toMatch(/^sub-\d+$/);
    expect(report.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("sets caveman_review to pending", () => {
    const manifest = {
      id: "test-skill",
      name: "Test Skill",
      version: "1.0.0",
      status: "active",
      category: "utility",
      runtime: "node",
      entrypoint: "src/index.ts",
      owner: "soren",
    };
    fs.writeFileSync(
      path.join(testDir, "SKILL.json"),
      JSON.stringify(manifest)
    );

    const report = validateSubmission(testDir);
    expect(report.checks.caveman_review).toBe("pending");
  });

  it("returns recommendation: reject for invalid manifest", () => {
    const manifest = {
      id: "invalid id", // Invalid pattern
      name: "Test Skill",
      version: "1.0.0",
      status: "active",
      category: "utility",
      runtime: "node",
      entrypoint: "src/index.ts",
      owner: "soren",
    };
    fs.writeFileSync(
      path.join(testDir, "SKILL.json"),
      JSON.stringify(manifest)
    );

    const report = validateSubmission(testDir);
    expect(report.recommendation).toBe("reject");
  });

  it("returns recommendation: approve for fully compliant skill", () => {
    const manifest = {
      id: "test-skill",
      name: "Test Skill",
      version: "1.0.0",
      status: "active",
      category: "utility",
      runtime: "node",
      entrypoint: "src/index.ts",
      owner: "soren",
      permissions: {
        required: ["file.read"],
        optional: [],
      },
    };
    fs.writeFileSync(
      path.join(testDir, "SKILL.json"),
      JSON.stringify(manifest)
    );

    const readmeContent = `
# Test Skill
## Purpose
This is a test skill.
## Usage
Use it like this.
## Permissions
Requires file.read.
`;
    fs.writeFileSync(path.join(testDir, "README.md"), readmeContent);

    const report = validateSubmission(testDir);
    expect(report.checks.manifest_valid).toBe(true);
    expect(report.checks.docs_complete).toBe(true);
    expect(report.checks.governance_aligned).toBe(true);
    expect(report.recommendation).toBe("approve");
  });
});
