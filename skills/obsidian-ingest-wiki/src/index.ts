import * as fs from "fs";
import * as path from "path";

/**
 * Obsidian Wiki Ingest Skill
 * Validates staged raw sources and generates Claude Code prompts for wiki synthesis.
 */

interface SkillInput {
  action: "validate" | "prompt";
  stagingPath?: string;
  vaultRoot?: string;
}

interface ValidationResult {
  status: "valid" | "invalid";
  stagingPath: string;
  manifestFile: string;
  fileCount: number;
  errors: string[];
  timestamp: string;
}

interface PromptResult {
  status: "success" | "error";
  prompt: string;
  stagingPath: string;
  vaultRoot: string;
  timestamp: string;
}

/**
 * Load Obsidian configuration from kb-sync config
 */
function loadConfig(vaultRoot?: string): {
  vaultRoot: string;
  stagingDir: string;
  wikiDir: string;
} {
  if (vaultRoot) {
    return {
      vaultRoot: normalizePath(vaultRoot),
      stagingDir: "_kb-sync-staging",
      wikiDir: "wiki",
    };
  }

  // Try to load from kb-sync config
  const configPath = path.join(
    process.cwd(),
    "configs",
    "obsidian.yaml"
  );

  if (!fs.existsSync(configPath)) {
    throw new Error(`Config not found: ${configPath}`);
  }

  const configContent = fs.readFileSync(configPath, "utf-8");
  const vaultRootMatch = configContent.match(/^\s*vault_root\s*[:=]\s*(.+)$/m);

  if (!vaultRootMatch) {
    throw new Error("vault_root not found in config");
  }

  const vault = normalizePath(vaultRootMatch[1].trim().replace(/["']/g, ""));

  return {
    vaultRoot: vault,
    stagingDir: "_kb-sync-staging",
    wikiDir: "wiki",
  };
}

/**
 * Normalize path (handle Windows backslashes)
 */
function normalizePath(inputPath: string): string {
  return inputPath.replace(/\\/g, "/").replace(/\/$/, "");
}

/**
 * Find latest staging directory
 */
function findLatestStaging(vaultRoot: string, stagingDir: string): string {
  const stagingPath = path.join(vaultRoot, stagingDir);

  if (!fs.existsSync(stagingPath)) {
    throw new Error(`Staging directory not found: ${stagingPath}`);
  }

  const dirs = fs.readdirSync(stagingPath);
  const timestampDirs = dirs.filter((d) =>
    /^\d{8}-\d{6}$/.test(d)
  );

  if (timestampDirs.length === 0) {
    throw new Error(
      `No timestamped staging directories found in ${stagingPath}`
    );
  }

  timestampDirs.sort().reverse();
  return path.join(stagingPath, timestampDirs[0]);
}

/**
 * Validate staging directory
 */
function validateStaging(stagingPath: string): ValidationResult {
  const errors: string[] = [];
  let fileCount = 0;

  // Check staging directory exists
  if (!fs.existsSync(stagingPath)) {
    errors.push(`Staging directory not found: ${stagingPath}`);
    return {
      status: "invalid",
      stagingPath,
      manifestFile: "",
      fileCount: 0,
      errors,
      timestamp: new Date().toISOString(),
    };
  }

  // Check manifest exists
  const manifestFile = path.join(stagingPath, "FILES.manifest.txt");
  if (!fs.existsSync(manifestFile)) {
    errors.push(`Manifest not found: ${manifestFile}`);
    return {
      status: "invalid",
      stagingPath,
      manifestFile,
      fileCount: 0,
      errors,
      timestamp: new Date().toISOString(),
    };
  }

  // Count files in manifest
  try {
    const manifestContent = fs.readFileSync(manifestFile, "utf-8");
    fileCount = manifestContent.split("\n").filter((line) => line.trim()).length;

    if (fileCount === 0) {
      errors.push("Manifest is empty");
    }
  } catch (err) {
    errors.push(`Failed to read manifest: ${err instanceof Error ? err.message : String(err)}`);
  }

  return {
    status: errors.length === 0 ? "valid" : "invalid",
    stagingPath,
    manifestFile,
    fileCount,
    errors,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Generate Claude Code prompt
 */
function generatePrompt(stagingPath: string, vaultRoot: string): PromptResult {
  const prompt = `
=== OBSIDIAN WIKI INGEST PROMPT ===

You are about to ingest staged raw sources into the Obsidian wiki using an 8-phase workflow.

**Staging Path:** ${stagingPath}
**Vault Root:** ${vaultRoot}
**Schema Document:** docs/targets/obsidian.md

**Workflow Phases:**
1. **Ingest** — Identify new entities and concepts from staged sources
2. **Lint** — Verify current wiki for structural/semantic issues
3. **Update** — Create/modify entity and concept pages
4. **Cross-Ref** — Establish bidirectional links
5. **Lint** — Re-verify after updates
6. **Log** — Record session in Log.md
7. **Review** — Spot-check for accuracy
8. **Commit** — Git commit with change summary

**Schema Reference:** Read docs/targets/obsidian.md for:
- Entity page format (summary, purpose, operations, links)
- Concept page format (problem, solution, examples)
- Cross-reference conventions
- Index and Log.md templates

**Constraints:**
- Do NOT edit raw sources (they are immutable)
- Preserve existing wiki content (append, don't overwrite)
- All pages link back to staging path for traceability
- Use exact schema format from obsidian.md

After completing phases 1-7, reply with: ✓ Wiki synthesis complete and your change summary.
`;

  return {
    status: "success",
    prompt: prompt.trim(),
    stagingPath,
    vaultRoot,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Main skill handler
 */
export async function handler(input: SkillInput): Promise<ValidationResult | PromptResult> {
  try {
    // Load configuration
    const config = loadConfig(input.vaultRoot);

    // Determine staging path
    let stagingPath = input.stagingPath;
    if (!stagingPath) {
      stagingPath = findLatestStaging(config.vaultRoot, config.stagingDir);
    } else {
      stagingPath = normalizePath(stagingPath);
    }

    // Execute action
    if (input.action === "validate") {
      return validateStaging(stagingPath);
    } else if (input.action === "prompt") {
      // Validate before generating prompt
      const validation = validateStaging(stagingPath);
      if (validation.status === "invalid") {
        throw new Error(
          `Staging validation failed: ${validation.errors.join("; ")}`
        );
      }
      return generatePrompt(stagingPath, config.vaultRoot);
    } else {
      throw new Error(
        `Invalid action: ${input.action}. Use 'validate' or 'prompt'.`
      );
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    return {
      status: "invalid",
      stagingPath: input.stagingPath || "unknown",
      manifestFile: "",
      fileCount: 0,
      errors: [errorMessage],
      timestamp: new Date().toISOString(),
    } as ValidationResult;
  }
}

// Export for testing
export { validateStaging, generatePrompt, loadConfig, findLatestStaging };
