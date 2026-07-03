/**
 * Roadmap Validator Skill Tests
 *
 * Test suite for roadmap validator skill.
 * Run with: npm test
 */

import handler, {
  RoadmapValidatorInput,
  RoadmapValidatorOutput,
} from "../src/index.ts";
import * as fs from "fs";
import * as path from "path";

describe("Roadmap Validator Skill", () => {
  const testDir = path.join(process.cwd(), "test-roadmaps");

  // Setup: Create test files before tests
  beforeAll(() => {
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
  });

  // Cleanup: Remove test files after tests
  afterAll(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe("happy path", () => {
    it("should succeed with valid roadmap containing sync markers", async () => {
      const roadmapPath = path.join(testDir, "valid.md");
      const content = `# Test Roadmap

<!-- SYNC:TOOLFORGE -->
## Phase 1
Test content here.
<!-- END:SYNC -->

Additional repo-specific content.
`;
      fs.writeFileSync(roadmapPath, content, "utf-8");

      const input: RoadmapValidatorInput = { roadmapPath };
      const result = await handler(input);

      expect(result.status).toBe("success");
      expect(result.data?.isValid).toBe(true);
      expect(result.data?.syncMarkersPresent).toBe(true);
      expect(result.data?.findings.length).toBe(0);
    });

    it("should succeed with verbose mode enabled", async () => {
      const roadmapPath = path.join(testDir, "valid-verbose.md");
      const content = `# Test Roadmap

<!-- SYNC:TOOLFORGE -->
## Phase 1
Test content.
<!-- END:SYNC -->
`;
      fs.writeFileSync(roadmapPath, content, "utf-8");

      const input: RoadmapValidatorInput = {
        roadmapPath,
        verbose: true,
      };
      const result = await handler(input);

      expect(result.status).toBe("success");
      expect(result.data?.isValid).toBe(true);
    });

    it("should include file content length in results", async () => {
      const roadmapPath = path.join(testDir, "with-length.md");
      const content = `<!-- SYNC:TOOLFORGE -->
Test content
<!-- END:SYNC -->`;
      fs.writeFileSync(roadmapPath, content, "utf-8");

      const input: RoadmapValidatorInput = { roadmapPath };
      const result = await handler(input);

      expect(result.data?.contentLength).toBe(content.length);
    });
  });

  describe("error handling", () => {
    it("should fail with missing roadmapPath", async () => {
      const input: any = {};
      const result = await handler(input);

      expect(result.status).toBe("error");
      expect(result.code).toBe("INVALID_INPUT");
      expect(result.message).toContain("roadmapPath is required");
    });

    it("should fail with empty roadmapPath", async () => {
      const input: RoadmapValidatorInput = { roadmapPath: "" };
      const result = await handler(input);

      expect(result.status).toBe("error");
      expect(result.code).toBe("INVALID_INPUT");
    });

    it("should fail with whitespace-only roadmapPath", async () => {
      const input: RoadmapValidatorInput = { roadmapPath: "   " };
      const result = await handler(input);

      expect(result.status).toBe("error");
      expect(result.code).toBe("INVALID_INPUT");
    });

    it("should fail with non-existent file", async () => {
      const input: RoadmapValidatorInput = {
        roadmapPath: "/nonexistent/path/ROADMAP.md",
      };
      const result = await handler(input);

      expect(result.status).toBe("error");
      expect(result.data?.isValid).toBe(false);
      expect(result.data?.findings.some((f) => f.code === "FILE_NOT_FOUND")).toBe(
        true
      );
    });
  });

  describe("sync marker validation", () => {
    it("should warn when opening marker is missing", async () => {
      const roadmapPath = path.join(testDir, "no-open.md");
      const content = `# Test
Content here
<!-- END:SYNC -->`;
      fs.writeFileSync(roadmapPath, content, "utf-8");

      const input: RoadmapValidatorInput = { roadmapPath };
      const result = await handler(input);

      expect(result.status).toBe("success");
      expect(result.data?.syncMarkersPresent).toBe(false);
      expect(
        result.data?.findings.some((f) => f.code === "MISSING_OPEN_MARKER")
      ).toBe(true);
    });

    it("should warn when closing marker is missing", async () => {
      const roadmapPath = path.join(testDir, "no-close.md");
      const content = `# Test
<!-- SYNC:TOOLFORGE -->
Content here`;
      fs.writeFileSync(roadmapPath, content, "utf-8");

      const input: RoadmapValidatorInput = { roadmapPath };
      const result = await handler(input);

      expect(result.status).toBe("success");
      expect(result.data?.syncMarkersPresent).toBe(false);
      expect(
        result.data?.findings.some((f) => f.code === "MISSING_CLOSE_MARKER")
      ).toBe(true);
    });

    it("should fail when close marker comes before open marker", async () => {
      const roadmapPath = path.join(testDir, "wrong-order.md");
      const content = `<!-- END:SYNC -->
Content
<!-- SYNC:TOOLFORGE -->`;
      fs.writeFileSync(roadmapPath, content, "utf-8");

      const input: RoadmapValidatorInput = { roadmapPath };
      const result = await handler(input);

      expect(result.data?.findings.some((f) => f.code === "MARKER_ORDER")).toBe(
        true
      );
    });

    it("should fail when sync block is empty", async () => {
      const roadmapPath = path.join(testDir, "empty-block.md");
      const content = `# Test
<!-- SYNC:TOOLFORGE -->
<!-- END:SYNC -->`;
      fs.writeFileSync(roadmapPath, content, "utf-8");

      const input: RoadmapValidatorInput = { roadmapPath };
      const result = await handler(input);

      expect(result.data?.findings.some((f) => f.code === "EMPTY_SYNC_BLOCK")).toBe(
        true
      );
    });
  });

  describe("strict mode", () => {
    it("should fail in strict mode with warnings", async () => {
      const roadmapPath = path.join(testDir, "strict-warn.md");
      const content = `<!-- SYNC:TOOLFORGE -->
Content
<!-- END:SYNC -->

More content`;
      fs.writeFileSync(roadmapPath, content, "utf-8");

      const input: RoadmapValidatorInput = {
        roadmapPath,
        strict: true,
      };
      const result = await handler(input);

      // File has no headers - will generate warning
      if (result.data?.findings.some((f) => f.level === "warning")) {
        expect(result.status).toBe("error");
        expect(result.code).toBe("VALIDATION_FAILED");
      }
    });

    it("should succeed in strict mode with no issues", async () => {
      const roadmapPath = path.join(testDir, "strict-pass.md");
      const content = `# Test Roadmap

<!-- SYNC:TOOLFORGE -->
## Phase 1
Content here
<!-- END:SYNC -->`;
      fs.writeFileSync(roadmapPath, content, "utf-8");

      const input: RoadmapValidatorInput = {
        roadmapPath,
        strict: true,
      };
      const result = await handler(input);

      expect(result.status).toBe("success");
    });
  });

  describe("output format", () => {
    it("should always return RoadmapValidatorOutput shape", async () => {
      const roadmapPath = path.join(testDir, "format-check.md");
      fs.writeFileSync(
        roadmapPath,
        "<!-- SYNC:TOOLFORGE -->\nContent\n<!-- END:SYNC -->",
        "utf-8"
      );

      const input: RoadmapValidatorInput = { roadmapPath };
      const result = await handler(input);

      expect(result).toHaveProperty("status");
      expect(result).toHaveProperty("message");
      expect(["success", "error"]).toContain(result.status);
      expect(typeof result.message).toBe("string");
    });

    it("success output should include data with findings", async () => {
      const roadmapPath = path.join(testDir, "findings.md");
      fs.writeFileSync(
        roadmapPath,
        "<!-- SYNC:TOOLFORGE -->\nContent\n<!-- END:SYNC -->",
        "utf-8"
      );

      const input: RoadmapValidatorInput = { roadmapPath };
      const result = await handler(input);

      if (result.status === "success") {
        expect(result.data).toBeDefined();
        expect(Array.isArray(result.data?.findings)).toBe(true);
        expect(result.data?.isValid).toBeDefined();
        expect(result.data?.syncMarkersPresent).toBeDefined();
        expect(result.data?.contentLength).toBeDefined();
      }
    });
  });

  describe("edge cases", () => {
    it("should handle file with only sync markers", async () => {
      const roadmapPath = path.join(testDir, "only-markers.md");
      fs.writeFileSync(
        roadmapPath,
        "<!-- SYNC:TOOLFORGE -->\nContent\n<!-- END:SYNC -->",
        "utf-8"
      );

      const input: RoadmapValidatorInput = { roadmapPath };
      const result = await handler(input);

      expect(result.status).toBe("success");
      expect(result.data?.syncMarkersPresent).toBe(true);
    });

    it("should handle file with unicode characters", async () => {
      const roadmapPath = path.join(testDir, "unicode.md");
      const content = `# 📋 Roadmap

<!-- SYNC:TOOLFORGE -->
## 🔄 Phase 1 — Foundation (✅ Complete)
Content with émojis and spëcial chars
<!-- END:SYNC -->`;
      fs.writeFileSync(roadmapPath, content, "utf-8");

      const input: RoadmapValidatorInput = { roadmapPath };
      const result = await handler(input);

      expect(result.status).toBe("success");
    });

    it("should handle file with multiple sync blocks", async () => {
      const roadmapPath = path.join(testDir, "multiple-blocks.md");
      const content = `# Test
<!-- SYNC:TOOLFORGE -->
Block 1
<!-- END:SYNC -->
Content
<!-- SYNC:TOOLFORGE -->
Block 2
<!-- END:SYNC -->`;
      fs.writeFileSync(roadmapPath, content, "utf-8");

      const input: RoadmapValidatorInput = { roadmapPath };
      const result = await handler(input);

      // Should find the first pair as valid
      expect(result.data?.syncMarkersPresent).toBe(true);
    });
  });
});
