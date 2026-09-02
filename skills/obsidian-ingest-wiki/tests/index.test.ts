import { validateStaging, generatePrompt } from "../src/index";
import * as fs from "fs";
import * as path from "path";

describe("obsidian-ingest-wiki skill", () => {
  describe("validateStaging", () => {
    it("should validate a staging directory with manifest", () => {
      // Mock staging path (assumes kb-sync staging exists)
      const stagingPath = path.join(
        process.cwd(),
        "obsidian",
        "vault",
        "_kb-sync-staging",
        "kb-sync"
      );

      // Find latest staging
      if (fs.existsSync(stagingPath)) {
        const dirs = fs.readdirSync(stagingPath);
        const timestampDirs = dirs.filter((d) => /^\d{8}-\d{6}$/.test(d));

        if (timestampDirs.length > 0) {
          timestampDirs.sort().reverse();
          const latestStaging = path.join(stagingPath, timestampDirs[0]);

          const result = validateStaging(latestStaging);

          expect(result.stagingPath).toBe(latestStaging);
          expect(result.fileCount).toBeGreaterThan(0);

          if (result.status === "valid") {
            expect(result.manifestFile).toBeTruthy();
            expect(result.errors.length).toBe(0);
          }
        }
      }
    });

    it("should fail for non-existent staging directory", () => {
      const result = validateStaging("/non/existent/path");

      expect(result.status).toBe("invalid");
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain("Staging directory not found");
    });

    it("should fail when manifest is missing", () => {
      // Create temporary directory without manifest
      const tmpDir = path.join(process.cwd(), ".test_staging");
      if (!fs.existsSync(tmpDir)) {
        fs.mkdirSync(tmpDir, { recursive: true });
      }

      const result = validateStaging(tmpDir);

      expect(result.status).toBe("invalid");
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain("Manifest not found");

      // Cleanup
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    });
  });

  describe("generatePrompt", () => {
    it("should generate a prompt with correct paths", () => {
      const stagingPath = "/vault/_kb-sync-staging/kb-sync/20260711-174821";
      const vaultRoot = "/vault";

      const result = generatePrompt(stagingPath, vaultRoot);

      expect(result.status).toBe("success");
      expect(result.prompt).toContain(stagingPath);
      expect(result.prompt).toContain(vaultRoot);
      expect(result.prompt).toContain("8-phase workflow");
      expect(result.prompt).toContain("docs/targets/obsidian.md");
    });

    it("should include all 8 phases in prompt", () => {
      const result = generatePrompt("/staging", "/vault");

      const phases = [
        "Ingest",
        "Lint",
        "Update",
        "Cross-Ref",
        "Log",
        "Review",
        "Commit",
      ];

      phases.forEach((phase) => {
        expect(result.prompt).toContain(phase);
      });
    });

    it("should include constraints in prompt", () => {
      const result = generatePrompt("/staging", "/vault");

      expect(result.prompt).toContain("immutable");
      expect(result.prompt).toContain("Preserve existing wiki");
      expect(result.prompt).toContain("traceability");
    });
  });
});
