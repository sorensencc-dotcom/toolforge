import * as fs from "fs";
import { exportRetroJson } from "../src/index";

describe("retro-export", () => {
  it("exports JSON schema v1.0 with the correct shape", async () => {
    const result = await exportRetroJson({
      testsRun: 12,
      testsPassed: 11,
      blockers: ["flaky integration test"],
      workSummary: "Implemented retro-export wrapper",
    });

    expect(result.success).toBe(true);
    expect(result.exportPath).toBeDefined();
    expect(result.exportPath).toContain("retro-export.json");

    const jsonContent = fs.readFileSync(result.exportPath as string, "utf-8");
    const parsed = JSON.parse(jsonContent);

    expect(parsed.version).toBe("1.0");
    expect(parsed.timestamp).toBeDefined();
    expect(parsed.tests_run).toBe(12);
    expect(parsed.tests_passed).toBe(11);
    expect(parsed.blockers).toEqual(["flaky integration test"]);
    expect(parsed.work_summary).toBe("Implemented retro-export wrapper");
  });

  it("handles missing optional fields gracefully with defaults", async () => {
    const result = await exportRetroJson({
      testsRun: 0,
      testsPassed: 0,
      blockers: [],
      workSummary: "",
    });

    expect(result.success).toBe(true);
    const jsonContent = fs.readFileSync(result.exportPath as string, "utf-8");
    const parsed = JSON.parse(jsonContent);
    expect(parsed.tests_run).toBe(0);
    expect(parsed.blockers).toEqual([]);
  });

  it("does not throw when the export write fails, and reports the error", async () => {
    jest.resetModules();
    jest.doMock("fs", () => {
      const actual = jest.requireActual("fs");
      return {
        ...actual,
        writeFileSync: (filePath: unknown, ...rest: any[]) => {
          if (typeof filePath === "string" && filePath.includes("retro-export.json")) {
            throw new Error("EACCES: permission denied (simulated AppData failure)");
          }
          return actual.writeFileSync(filePath, ...rest);
        },
      };
    });

    try {
      const { exportRetroJson: exportRetroJsonWithMockedFs } = require("../src/index");
      const result = await exportRetroJsonWithMockedFs({
        testsRun: 5,
        testsPassed: 5,
        blockers: [],
        workSummary: "Should not throw",
      });

      expect(result.success).toBe(false);
      expect(result.exportPath).toBeUndefined();
      expect(result.error).toContain("EACCES");
    } finally {
      jest.dontMock("fs");
      jest.resetModules();
    }
  });
});
