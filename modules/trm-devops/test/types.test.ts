import test from "node:test";
import assert from "node:assert/strict";
import type { DefectItem } from "../src/core/types.ts";

test("DefectItem interface type compliance", () => {
  const item: DefectItem = {
    id: "DEV-001",
    signatureHash: "3fe6031c62d2dec97126940c2ecdc3d19de29526da5b55821b992df3e4cd15cb",
    sourceFingerprint: "fingerprint-123",
    status: "OPEN",
    title: "Test CI Failure",
    targetRepo: "sorensencc-dotcom/toolforge",
    failingWorkflows: [{ name: "Governance", commitSha: "543b2e2" }],
    blastRadius: "P0",
    primarySuspects: ["Missing token"],
    actionSteps: ["gh run view --log-failed"],
    sourceId: "src-uuid-1",
    firstSeen: "2026-08-28T11:00:00Z",
    lastObserved: "2026-08-28T11:00:00Z",
    tags: ["ci"]
  };
  assert.equal(item.status, "OPEN");
  assert.equal(item.blastRadius, "P0");
});
