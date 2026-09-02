import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import os from "os";
import crypto from "crypto";
import { validateDefectChunk, quarantineMalformedChunk } from "../src/core/extractor.ts";
import * as trmDevops from "../src/index.ts";

test("validateDefectChunk returns null for non-objects or missing required keys", () => {
  assert.equal(validateDefectChunk(null), null);
  assert.equal(validateDefectChunk(undefined), null);
  assert.equal(validateDefectChunk("string"), null);
  assert.equal(validateDefectChunk(12345), null);
  assert.equal(validateDefectChunk([]), null);
  assert.equal(validateDefectChunk({}), null);
  assert.equal(validateDefectChunk({ signatureHash: "hash123" }), null);
  assert.equal(validateDefectChunk({ title: "Title only" }), null);
});

test("validateDefectChunk parses valid chunk with defaults for missing optionals", () => {
  const raw = {
    signatureHash: "abc1234",
    title: "Test Error",
    targetRepo: "sorensencc-dotcom/toolforge",
    failingWorkflows: [{ name: "Release", commitSha: "123456" }],
    blastRadius: "P1",
    primarySuspects: ["Unknown secret"],
    actionSteps: ["gh secret list"],
    sourceId: "src-1"
  };

  const defect = validateDefectChunk(raw);
  assert.ok(defect);
  assert.equal(defect.id, "DEV-NEW");
  assert.equal(defect.signatureHash, "abc1234");
  assert.equal(defect.title, "Test Error");
  assert.equal(defect.status, "OPEN");
  assert.equal(defect.blastRadius, "P1");
  assert.equal(defect.targetRepo, "sorensencc-dotcom/toolforge");
  assert.equal(defect.tags.length, 0);
  assert.equal(defect.primarySuspects[0], "Unknown secret");
  assert.equal(defect.actionSteps[0], "gh secret list");
  assert.equal(defect.sourceId, "src-1");
  assert.ok(defect.firstSeen);
  assert.ok(defect.lastObserved);
  assert.equal(defect.failingWorkflows.length, 1);
  assert.equal(defect.failingWorkflows[0].name, "Release");
  assert.equal(defect.failingWorkflows[0].commitSha, "123456");
});

test("validateDefectChunk validates status and blastRadius enums with proper defaults", () => {
  const base = { signatureHash: "hash-enum", title: "Enum Test" };

  const defaultItem = validateDefectChunk(base);
  assert.ok(defaultItem);
  assert.equal(defaultItem.status, "OPEN");
  assert.equal(defaultItem.blastRadius, "P2");
  assert.equal(defaultItem.targetRepo, "UNKNOWN");

  const invalidEnumItem = validateDefectChunk({
    ...base,
    status: "INVALID_STATUS",
    blastRadius: "P99"
  });
  assert.ok(invalidEnumItem);
  assert.equal(invalidEnumItem.status, "OPEN");
  assert.equal(invalidEnumItem.blastRadius, "P2");

  const validStatuses = ["OPEN", "IN_PROGRESS", "RESOLVED", "MUTED"] as const;
  for (const s of validStatuses) {
    const item = validateDefectChunk({ ...base, status: s });
    assert.equal(item?.status, s);
  }

  const validRadii = ["P0", "P1", "P2", "P3", "P4"] as const;
  for (const r of validRadii) {
    const item = validateDefectChunk({ ...base, blastRadius: r });
    assert.equal(item?.blastRadius, r);
  }
});

test("validateDefectChunk computes SHA-256 fingerprint when not provided", () => {
  const raw = {
    signatureHash: "hash-fp",
    title: "Fingerprint test",
    sourceId: "src-fp"
  };

  const expectedFingerprint = crypto.createHash("sha256").update(JSON.stringify(raw)).digest("hex");
  const defect = validateDefectChunk(raw);
  assert.ok(defect);
  assert.equal(defect.sourceFingerprint, expectedFingerprint);

  const customFpItem = validateDefectChunk({
    ...raw,
    sourceFingerprint: "explicit-fp-123"
  });
  assert.equal(customFpItem?.sourceFingerprint, "explicit-fp-123");
});

test("validateDefectChunk normalizes failingWorkflows correctly", () => {
  const raw = {
    signatureHash: "hash-wf",
    title: "Workflow test",
    failingWorkflows: [
      {
        name: "CI / Node 20",
        commitSha: "abcde12",
        runId: "987654321",
        job: "build-and-test",
        step: "npm test",
        runner: "ubuntu-latest",
        attempt: 2
      },
      {
        // missing name and commitSha - defaults to fallback
      }
    ]
  };

  const defect = validateDefectChunk(raw);
  assert.ok(defect);
  assert.equal(defect.failingWorkflows.length, 2);
  assert.equal(defect.failingWorkflows[0].name, "CI / Node 20");
  assert.equal(defect.failingWorkflows[0].commitSha, "abcde12");
  assert.equal(defect.failingWorkflows[0].runId, "987654321");
  assert.equal(defect.failingWorkflows[0].job, "build-and-test");
  assert.equal(defect.failingWorkflows[0].step, "npm test");
  assert.equal(defect.failingWorkflows[0].runner, "ubuntu-latest");
  assert.equal(defect.failingWorkflows[0].attempt, 2);

  assert.equal(defect.failingWorkflows[1].name, "Unknown Workflow");
  assert.equal(defect.failingWorkflows[1].commitSha, "HEAD");
  assert.equal(defect.failingWorkflows[1].runId, undefined);
});

test("quarantineMalformedChunk writes invalid chunk to cache dir with proper filename format", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "extractor-test-"));
  const invalidJson = "{ malformed json content: [[ not valid }";

  const savedFile = quarantineMalformedChunk(invalidJson, tmpDir);
  assert.ok(fs.existsSync(savedFile));

  const fileName = path.basename(savedFile);
  assert.match(fileName, /^unparsed-chunks-\d+-[a-f0-9]+\.json$/);

  const fileContent = fs.readFileSync(savedFile, "utf8");
  assert.equal(fileContent, invalidJson);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("quarantineMalformedChunk creates cache directory recursively if missing", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "extractor-test-nested-"));
  const nestedCacheDir = path.join(tmpDir, "deeply", "nested", ".cache");
  const unparsedData = "corrupt raw stream payload";

  const savedFile = quarantineMalformedChunk(unparsedData, nestedCacheDir);
  assert.ok(fs.existsSync(savedFile));
  assert.equal(fs.readFileSync(savedFile, "utf8"), unparsedData);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("index.ts re-exports extractor functions", () => {
  assert.equal(typeof trmDevops.validateDefectChunk, "function");
  assert.equal(typeof trmDevops.quarantineMalformedChunk, "function");
});
