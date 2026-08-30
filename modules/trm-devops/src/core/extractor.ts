import fs from "fs";
import path from "path";
import crypto from "crypto";
import type { DefectItem, DefectStatus, BlastRadiusRating } from "./types.ts";

export function validateDefectChunk(raw: any): DefectItem | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  if (!raw.signatureHash || !raw.title) return null;

  const validStatuses: DefectStatus[] = ["OPEN", "IN_PROGRESS", "RESOLVED", "MUTED"];
  const validBlast: BlastRadiusRating[] = ["P0", "P1", "P2", "P3", "P4"];

  const rawJson = JSON.stringify(raw);
  const defaultFingerprint = crypto.createHash("sha256").update(rawJson).digest("hex");

  return {
    id: raw.id ? String(raw.id) : "DEV-NEW",
    signatureHash: String(raw.signatureHash),
    parentHash: raw.parentHash ? String(raw.parentHash) : undefined,
    sourceFingerprint: raw.sourceFingerprint ? String(raw.sourceFingerprint) : defaultFingerprint,
    status: validStatuses.includes(raw.status) ? raw.status : "OPEN",
    title: String(raw.title),
    targetRepo: raw.targetRepo ? String(raw.targetRepo) : "UNKNOWN",
    failingWorkflows: Array.isArray(raw.failingWorkflows)
      ? raw.failingWorkflows.map((w: any) => ({
          name: String(w?.name || "Unknown Workflow"),
          commitSha: String(w?.commitSha || "HEAD"),
          runId: w?.runId ? String(w.runId) : undefined,
          job: w?.job ? String(w.job) : undefined,
          step: w?.step ? String(w.step) : undefined,
          runner: w?.runner ? String(w.runner) : undefined,
          attempt: typeof w?.attempt === "number" ? w.attempt : undefined
        }))
      : [],
    blastRadius: validBlast.includes(raw.blastRadius) ? raw.blastRadius : "P2",
    primarySuspects: Array.isArray(raw.primarySuspects) ? raw.primarySuspects.map(String) : [],
    actionSteps: Array.isArray(raw.actionSteps) ? raw.actionSteps.map(String) : [],
    sourceId: raw.sourceId ? String(raw.sourceId) : "LOCAL",
    firstSeen: raw.firstSeen ? String(raw.firstSeen) : new Date().toISOString(),
    lastObserved: raw.lastObserved ? String(raw.lastObserved) : new Date().toISOString(),
    lastAction: raw.lastAction ? String(raw.lastAction) : undefined,
    triageOwner: raw.triageOwner ? String(raw.triageOwner) : undefined,
    tags: Array.isArray(raw.tags) ? raw.tags.map(String) : [],
    operatorNotes: raw.operatorNotes
  };
}

export function quarantineMalformedChunk(rawChunk: string, cacheDir: string): string {
  fs.mkdirSync(cacheDir, { recursive: true });
  const filename = `unparsed-chunks-${Date.now()}-${crypto.randomBytes(4).toString("hex")}.json`;
  const filePath = path.join(cacheDir, filename);
  fs.writeFileSync(filePath, rawChunk, "utf8");
  return filePath;
}
