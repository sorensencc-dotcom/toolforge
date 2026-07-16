import { execFile } from "node:child_process";
import { resolve, extname } from "node:path";
import { existsSync, statSync } from "node:fs";

const DEFAULT_XBERG_PATH = "C:\\tools\\xberg\\xberg.exe";

export async function ingest({ file }) {
  return new Promise((resolvePromise, rejectPromise) => {
    if (!file) {
      return rejectPromise("Missing required argument: file");
    }
    const pdfPath = resolve(file);
    if (extname(pdfPath).toLowerCase() !== ".pdf") {
      return rejectPromise(`Refusing to process non-PDF path: ${pdfPath}`);
    }
    if (!existsSync(pdfPath) || !statSync(pdfPath).isFile()) {
      return rejectPromise(`File not found: ${pdfPath}`);
    }

    const XBERG = process.env.XBERG_PATH || DEFAULT_XBERG_PATH;
    if (!existsSync(XBERG)) {
      return rejectPromise(`Xberg binary not found at ${XBERG}. Set XBERG_PATH or install to ${DEFAULT_XBERG_PATH}.`);
    }

    execFile(
      XBERG,
      ["extract", pdfPath, "--json"],
      { maxBuffer: 1024 * 1024 * 256 },
      (err, stdout, stderr) => {
        if (err) {
          return rejectPromise(stderr || err.message);
        }
        if (!stdout || stdout.trim().length === 0) {
          return rejectPromise("Xberg returned empty output");
        }
        try {
          const parsed = JSON.parse(stdout);
          resolvePromise({
            plugin: "toolforge-pdf-ingestion",
            version: "1.0.0",
            data: parsed
          });
        } catch (parseErr) {
          rejectPromise(`Failed to parse Xberg output: ${parseErr.message}`);
        }
      }
    );
  });
}
