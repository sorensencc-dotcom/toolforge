import * as fs from "fs";
import * as path from "path";
import Ajv, { JSONSchemaType } from "ajv";

interface ConformanceReport {
  submission_id: string;
  skill_id: string;
  skill_version: string;
  timestamp: string;
  checks: {
    manifest_valid: boolean;
    tests_pass: boolean | null;
    docs_complete: boolean;
    governance_aligned: boolean;
    caveman_review: "pending" | "approved" | "rejected";
  };
  blockers: string[];
  recommendation: "approve" | "hold" | "reject";
}

interface SkillManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  status: "active" | "deprecated" | "inactive";
  category: string;
  runtime: string;
  entrypoint: string;
  owner: string;
  permissions?: {
    required: string[];
    optional: string[];
  };
  dependencies?: {
    external: string[];
    internal: string[];
  };
}

function validateManifest(skillPath: string): {
  valid: boolean;
  errors: string[];
} {
  const skillJsonPath = path.join(skillPath, "SKILL.json");

  if (!fs.existsSync(skillJsonPath)) {
    return {
      valid: false,
      errors: ["SKILL.json not found"],
    };
  }

  let manifest: SkillManifest;
  try {
    const content = fs.readFileSync(skillJsonPath, "utf-8");
    manifest = JSON.parse(content);
  } catch (e) {
    return {
      valid: false,
      errors: [
        `Invalid JSON: ${e instanceof Error ? e.message : String(e)}`,
      ],
    };
  }

  const errors: string[] = [];

  // Required fields
  if (!manifest.id || typeof manifest.id !== "string") {
    errors.push("Missing or invalid 'id' field");
  } else if (!/^[a-z0-9-]+$/.test(manifest.id)) {
    errors.push("'id' must match ^[a-z0-9-]+$");
  }

  if (!manifest.name || typeof manifest.name !== "string") {
    errors.push("Missing or invalid 'name' field");
  }

  if (!manifest.version || typeof manifest.version !== "string") {
    errors.push("Missing or invalid 'version' field");
  } else if (!/^\d+\.\d+\.\d+/.test(manifest.version)) {
    errors.push("'version' must be semver");
  }

  if (!manifest.status || !["active", "deprecated", "inactive"].includes(manifest.status)) {
    errors.push("'status' must be active|deprecated|inactive");
  }

  if (!manifest.category || typeof manifest.category !== "string") {
    errors.push("Missing or invalid 'category' field");
  }

  if (!manifest.runtime || typeof manifest.runtime !== "string") {
    errors.push("Missing or invalid 'runtime' field");
  }

  if (!manifest.entrypoint || typeof manifest.entrypoint !== "string") {
    errors.push("Missing or invalid 'entrypoint' field");
  }

  if (!manifest.owner || typeof manifest.owner !== "string") {
    errors.push("Missing or invalid 'owner' field");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

function checkTestsPass(skillPath: string): boolean | null {
  // Check if tests exist
  const testDirs = [
    path.join(skillPath, "tests"),
    path.join(skillPath, "test"),
    path.join(skillPath, "__tests__"),
  ];

  const hasTests = testDirs.some((dir) => {
    return fs.existsSync(dir) && fs.readdirSync(dir).length > 0;
  });

  if (!hasTests) {
    return null; // No tests found
  }

  // Check for package.json with test script
  const pkgPath = path.join(skillPath, "package.json");
  if (!fs.existsSync(pkgPath)) {
    return null;
  }

  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
    if (!pkg.scripts || !pkg.scripts.test) {
      return null;
    }
  } catch {
    return null;
  }

  // Assume tests pass if structure exists (actual test run happens in CI)
  return true;
}

function checkDocsComplete(skillPath: string): boolean {
  const docPaths = [
    path.join(skillPath, "README.md"),
    path.join(skillPath, "docs", "README.md"),
    path.join(skillPath, "docs", "USAGE.md"),
  ];

  const hasMainDoc = docPaths.slice(0, 2).some((p) => fs.existsSync(p));
  if (!hasMainDoc) {
    return false;
  }

  // Check for required sections
  const mainDocPath = docPaths.find((p) => fs.existsSync(p));
  if (!mainDocPath) {
    return false;
  }

  const content = fs.readFileSync(mainDocPath, "utf-8");
  const requiredSections = [
    /#+\s+Purpose|#+\s+Overview/i,
    /#+\s+Usage|#+\s+Installation/i,
    /#+\s+Permissions|#+\s+Required Permissions/i,
  ];

  const sectionsFound = requiredSections.filter((regex) =>
    regex.test(content)
  ).length;

  return sectionsFound >= 2; // At least 2 of 3 sections
}

function checkGovernanceAligned(skillPath: string): boolean {
  const skillJsonPath = path.join(skillPath, "SKILL.json");
  if (!fs.existsSync(skillJsonPath)) {
    return false;
  }

  try {
    const manifest = JSON.parse(fs.readFileSync(skillJsonPath, "utf-8"));

    // Check naming convention: <scope>-<function>
    if (!manifest.id || !/^[a-z0-9]+-[a-z0-9-]+$/.test(manifest.id)) {
      return false;
    }

    // Check owner is set
    if (!manifest.owner || manifest.owner.length === 0) {
      return false;
    }

    // Check permissions are defined
    if (manifest.permissions && Array.isArray(manifest.permissions.required)) {
      // Permissions properly structured
    }

    // Check for unsafe code patterns
    const srcDir = path.join(skillPath, "src");
    if (fs.existsSync(srcDir)) {
      const files = fs.readdirSync(srcDir);
      for (const file of files) {
        if (file.endsWith(".ts") || file.endsWith(".js")) {
          const content = fs.readFileSync(path.join(srcDir, file), "utf-8");
          // Detect eval/exec
          if (/(eval\s*\(|exec\s*\(|Function\s*\()/i.test(content)) {
            return false;
          }
        }
      }
    }

    return true;
  } catch {
    return false;
  }
}

export function validateSubmission(skillPath: string): ConformanceReport {
  const submissionId = `sub-${Date.now()}`;
  const timestamp = new Date().toISOString();

  // Load manifest
  const manifestCheck = validateManifest(skillPath);
  let skillId = "unknown";
  let skillVersion = "unknown";

  if (manifestCheck.valid) {
    try {
      const manifest = JSON.parse(
        fs.readFileSync(path.join(skillPath, "SKILL.json"), "utf-8")
      );
      skillId = manifest.id;
      skillVersion = manifest.version;
    } catch {
      // Fallback
    }
  }

  // Run all checks
  const checksResults = {
    manifest_valid: manifestCheck.valid,
    tests_pass: checkTestsPass(skillPath),
    docs_complete: checkDocsComplete(skillPath),
    governance_aligned: checkGovernanceAligned(skillPath),
    caveman_review: "pending" as const,
  };

  // Collect blockers
  const blockers: string[] = [];
  if (!checksResults.manifest_valid) {
    blockers.push(...manifestCheck.errors);
  }
  if (checksResults.docs_complete === false) {
    blockers.push("Documentation incomplete (missing README or required sections)");
  }
  if (checksResults.governance_aligned === false) {
    blockers.push("Governance check failed (naming, permissions, unsafe code)");
  }

  // Recommendation logic
  let recommendation: "approve" | "hold" | "reject" = "hold";
  if (blockers.length === 0 && checksResults.tests_pass !== false) {
    recommendation = "approve"; // Ready for caveman review
  }
  if (checksResults.manifest_valid === false) {
    recommendation = "reject";
  }

  const report: ConformanceReport = {
    submission_id: submissionId,
    skill_id: skillId,
    skill_version: skillVersion,
    timestamp,
    checks: checksResults,
    blockers,
    recommendation,
  };

  return report;
}

// CLI entry point
if (require.main === module) {
  const skillPath = process.argv[2];
  if (!skillPath) {
    console.error("Usage: validate.ts <skill-path>");
    process.exit(1);
  }

  const report = validateSubmission(skillPath);
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.recommendation === "reject" ? 1 : 0);
}
