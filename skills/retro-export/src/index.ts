import * as fs from "fs";
import * as path from "path";
import * as os from "os";

export interface RetroExportParams {
  testsRun: number;
  testsPassed: number;
  blockers: string[];
  workSummary: string;
}

export interface RetroExportSchema {
  version: string;
  timestamp: string;
  tests_run: number;
  tests_passed: number;
  blockers: string[];
  work_summary: string;
}

export interface RetroExportResult {
  success: boolean;
  exportPath?: string;
  error?: string;
}

function resolveExportPath(): string {
  const appDataPath =
    process.platform === "win32"
      ? path.join(os.homedir(), "AppData", "Roaming")
      : path.join(os.homedir(), ".config");

  const exportDir = path.join(appDataPath, "Claude");
  return path.join(exportDir, "retro-export.json");
}

export async function exportRetroJson(params: RetroExportParams): Promise<RetroExportResult> {
  const schema: RetroExportSchema = {
    version: "1.0",
    timestamp: new Date().toISOString(),
    tests_run: typeof params.testsRun === "number" ? params.testsRun : 0,
    tests_passed: typeof params.testsPassed === "number" ? params.testsPassed : 0,
    blockers: params.blockers || [],
    work_summary: params.workSummary || "",
  };

  const exportPath = resolveExportPath();

  try {
    fs.mkdirSync(path.dirname(exportPath), { recursive: true });
    fs.writeFileSync(exportPath, JSON.stringify(schema, null, 2), "utf-8");
    return { success: true, exportPath };
  } catch (err) {
    // Export failure is non-fatal — the wrapper never fails the caller
    // on a write error, it just reports it.
    const message = err instanceof Error ? err.message : String(err);
    console.error(`retro-export: JSON export failed, continuing without it: ${message}`);
    return { success: false, error: message };
  }
}

export default exportRetroJson;
