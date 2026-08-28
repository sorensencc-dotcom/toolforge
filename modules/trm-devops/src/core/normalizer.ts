import crypto from "crypto";

export function normalizeErrorTrace(rawTrace: string): string {
  return rawTrace
    .replace(/\x1b\[[0-9;]*m/g, "")
    .replace(/\\/g, "/")
    .replace(/(?:\/home\/runner\/work\/[^\/]+|[a-zA-Z]:\/Users\/[^\/]+\/work\/[^\/]+|[a-zA-Z]:\/[^\/]+\/work\/[^\/]+)/gi, "<WORKDIR>")
    .replace(/container_[a-zA-Z0-9_\-]+/gi, "<CONTAINER>")
    .replace(/runner-[a-zA-Z0-9_\-]+/gi, "<RUNNER>")
    .replace(/\bPID:\s*\d+\b/gi, "<PID>")
    .replace(/^[ \t]*\[?\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?\]?[ \t]*/gm, "")
    .replace(/\[\d+(?:\.\d+)?(?:ms|s)\]/gi, "")
    .split("\n")
    .map((line) => line.trim().replace(/[ \t]+/g, " "))
    .filter((line) => line.length > 0)
    .join("\n");
}

export function computeSignatureHash(rawTrace: string): string {
  const normalized = normalizeErrorTrace(rawTrace);
  return crypto.createHash("sha256").update(normalized).digest("hex");
}
