/**
 * Template Skill Tests
 *
 * Test suite for template skill.
 * Run with: npm test
 */

import fs from "node:fs";
import path from "node:path";

import handler, { SkillInput, SkillOutput } from "../src/index.ts";

/**
 * External fixtures — graceful skip.
 *
 * Some skills need a fixture that is NOT committed to this repo (a large sample
 * corpus, a checked-out sibling repo, a generated artifact directory). Never let
 * an absent fixture break `npm test` for everyone. Gate the block instead:
 *
 *   const FIXTURE = path.resolve(__dirname, "fixtures/large-corpus");
 *   const withFixture = fs.existsSync(FIXTURE) ? describe : describe.skip;
 *   withFixture("against the real corpus", () => { ... });
 *
 * A skipped block is reported (not silently passed), so the gap stays visible.
 * Keep the committed happy-path / error / edge tests fixture-free so they always run.
 */
const FIXTURE_DIR = path.resolve(__dirname, "fixtures");
const withFixtures =
  fs.existsSync(FIXTURE_DIR) && fs.readdirSync(FIXTURE_DIR).length > 0
    ? describe
    : describe.skip;

describe("Template Skill", () => {
  describe("happy path", () => {
    it("should succeed with valid input", async () => {
      const input: SkillInput = { input1: "test-data" };
      const result = await handler(input);

      expect(result.status).toBe("success");
      expect(result.message).toContain("completed");
      expect(result.data).toBeDefined();
    });

    it("should include processed data in output", async () => {
      const input: SkillInput = { input1: "test-data" };
      const result = await handler(input);

      expect(result.data?.processed).toBe("test-data");
      expect(result.data?.timestamp).toBeDefined();
      expect(result.data?.length).toBe("test-data".length);
    });

    it("should handle optional verbose parameter", async () => {
      const input: SkillInput = { input1: "test-data", verbose: true };
      const result = await handler(input);

      expect(result.status).toBe("success");
    });
  });

  describe("error handling", () => {
    it("should fail with missing input1", async () => {
      const input: SkillInput = { input1: "" };
      const result = await handler(input);

      expect(result.status).toBe("error");
      expect(result.code).toBe("INVALID_INPUT");
      expect(result.message).toContain("validation failed");
    });

    it("should fail with null input1", async () => {
      const input: any = { input1: null };
      const result = await handler(input);

      expect(result.status).toBe("error");
      expect(result.code).toBe("INVALID_INPUT");
    });

    it("should fail with undefined input1", async () => {
      const input: any = {};
      const result = await handler(input);

      expect(result.status).toBe("error");
      expect(result.code).toBe("INVALID_INPUT");
    });

    it("should handle non-string input1", async () => {
      const input: any = { input1: 123 };
      const result = await handler(input);

      expect(result.status).toBe("error");
      expect(result.code).toBe("INVALID_INPUT");
    });

    it("should handle whitespace-only input1", async () => {
      const input: SkillInput = { input1: "   " };
      const result = await handler(input);

      expect(result.status).toBe("error");
      expect(result.code).toBe("INVALID_INPUT");
    });
  });

  describe("output format", () => {
    it("should always return SkillOutput shape", async () => {
      const input: SkillInput = { input1: "test" };
      const result = await handler(input);

      expect(result).toHaveProperty("status");
      expect(result).toHaveProperty("message");
      expect(["success", "error"]).toContain(result.status);
      expect(typeof result.message).toBe("string");
    });

    it("success output should include data", async () => {
      const input: SkillInput = { input1: "test" };
      const result = await handler(input);

      if (result.status === "success") {
        expect(result.data).toBeDefined();
        expect(typeof result.data).toBe("object");
      }
    });

    it("error output should include code", async () => {
      const input: SkillInput = { input1: "" };
      const result = await handler(input);

      if (result.status === "error") {
        expect(result.code).toBeDefined();
        expect(typeof result.code).toBe("string");
      }
    });
  });

  describe("edge cases", () => {
    it("should handle very long input", async () => {
      const longInput = "x".repeat(10000);
      const input: SkillInput = { input1: longInput };
      const result = await handler(input);

      expect(result.status).toBe("success");
      expect(result.data?.length).toBe(10000);
    });

    it("should handle special characters", async () => {
      const input: SkillInput = { input1: "!@#$%^&*()_+-=[]{}|;:',.<>?/~`" };
      const result = await handler(input);

      expect(result.status).toBe("success");
      expect(result.data?.processed).toBe(input.input1);
    });

    it("should handle unicode characters", async () => {
      const input: SkillInput = { input1: "Hello 世界 🌍" };
      const result = await handler(input);

      expect(result.status).toBe("success");
      expect(result.data?.processed).toBe(input.input1);
    });
  });

  // Runs only when tests/fixtures/ exists and is non-empty; otherwise reported
  // as skipped. Replace with your skill's real fixture-backed assertions.
  withFixtures("against external fixtures", () => {
    it("processes a fixture file end to end", async () => {
      const sample = fs
        .readdirSync(FIXTURE_DIR)
        .find((f) => fs.statSync(path.join(FIXTURE_DIR, f)).isFile());
      expect(sample).toBeDefined();

      const input: SkillInput = {
        input1: fs.readFileSync(path.join(FIXTURE_DIR, sample!), "utf8"),
      };
      const result = await handler(input);

      expect(result.status).toBe("success");
    });
  });
});
