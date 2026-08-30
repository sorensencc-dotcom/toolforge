import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import os from "os";
import { pruneResolvedDefects } from "../src/core/pruning.ts";
import { renderQueueMarkdown } from "../src/core/reconciler.ts";
import { NotebookLMClient } from "../src/core/notebooklm-client.ts";
import type { DefectItem, ArchiveIndexEntry } from "../src/core/types.ts";
import * as trmDevops from "../src/index.ts";

test("pruneResolvedDefects moves RESOLVED items, updates index.json, and leaves active items", async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "prune-test-"));
  const queuePath = path.join(tmpDir, "queue.md");
  const archiveDir = path.join(tmpDir, "archive");

  const items: DefectItem[] = [
    {
      id: "DEV-001",
      signatureHash: "hash-001",
      parentHash: "parent-001",
      sourceFingerprint: "fp-001",
      status: "RESOLVED",
      title: "Fixed Bug",
      targetRepo: "sorensencc-dotcom/toolforge",
      failingWorkflows: [],
      blastRadius: "P0",
      primarySuspects: [],
      actionSteps: [],
      sourceId: "src-1",
      firstSeen: "2026-08-28T11:00:00.000Z",
      lastObserved: "2026-08-28T11:30:00.000Z",
      triageOwner: "@operator",
      tags: ["ci", "governance"]
    },
    {
      id: "DEV-002",
      signatureHash: "hash-002",
      sourceFingerprint: "fp-002",
      status: "OPEN",
      title: "Still Broken",
      targetRepo: "sorensencc-dotcom/toolforge",
      failingWorkflows: [],
      blastRadius: "P1",
      primarySuspects: [],
      actionSteps: [],
      sourceId: "src-2",
      firstSeen: "2026-08-28T11:00:00.000Z",
      lastObserved: "2026-08-28T11:30:00.000Z",
      tags: ["release"]
    }
  ];

  fs.writeFileSync(queuePath, renderQueueMarkdown(items), "utf8");

  const archived = await pruneResolvedDefects(queuePath, archiveDir);
  assert.equal(archived.length, 1);
  assert.equal(archived[0].id, "DEV-001");
  assert.equal(archived[0].signatureHash, "hash-001");
  assert.equal(archived[0].parentHash, "parent-001");
  assert.equal(archived[0].targetRepo, "sorensencc-dotcom/toolforge");
  assert.equal(archived[0].blastRadius, "P0");
  assert.equal(archived[0].firstSeen, "2026-08-28T11:00:00.000Z");
  assert.equal(archived[0].triageOwner, "@operator");
  assert.deepEqual(archived[0].tags, ["ci", "governance"]);
  assert.ok(archived[0].durationMs >= 0);
  assert.match(archived[0].archiveFile, /^\d{4}-\d{2}\/resolved-defects\.md$/);

  const indexPath = path.join(archiveDir, "index.json");
  assert.ok(fs.existsSync(indexPath));
  const indexData = JSON.parse(fs.readFileSync(indexPath, "utf8"));
  assert.equal(indexData.length, 1);
  assert.equal(indexData[0].id, "DEV-001");

  const updatedQueue = fs.readFileSync(queuePath, "utf8");
  assert.ok(!updatedQueue.includes("DEV-001"));
  assert.ok(updatedQueue.includes("DEV-002"));
  assert.ok(updatedQueue.includes("Still Broken"));

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("pruneResolvedDefects returns empty array when no resolved items exist", async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "prune-test-none-"));
  const queuePath = path.join(tmpDir, "queue.md");
  const archiveDir = path.join(tmpDir, "archive");

  const items: DefectItem[] = [
    {
      id: "DEV-001",
      signatureHash: "hash-001",
      sourceFingerprint: "fp-001",
      status: "OPEN",
      title: "Open Bug",
      targetRepo: "sorensencc-dotcom/toolforge",
      failingWorkflows: [],
      blastRadius: "P0",
      primarySuspects: [],
      actionSteps: [],
      sourceId: "src-1",
      firstSeen: "2026-08-28T11:00:00.000Z",
      lastObserved: "2026-08-28T11:30:00.000Z",
      tags: ["ci"]
    },
    {
      id: "DEV-002",
      signatureHash: "hash-002",
      sourceFingerprint: "fp-002",
      status: "IN_PROGRESS",
      title: "In Progress Bug",
      targetRepo: "sorensencc-dotcom/toolforge",
      failingWorkflows: [],
      blastRadius: "P1",
      primarySuspects: [],
      actionSteps: [],
      sourceId: "src-2",
      firstSeen: "2026-08-28T11:00:00.000Z",
      lastObserved: "2026-08-28T11:30:00.000Z",
      tags: ["release"]
    }
  ];

  fs.writeFileSync(queuePath, renderQueueMarkdown(items), "utf8");

  const archived = await pruneResolvedDefects(queuePath, archiveDir);
  assert.equal(archived.length, 0);
  assert.ok(!fs.existsSync(archiveDir));

  // Lock must be released
  assert.ok(!fs.existsSync(`${queuePath}.lock`));

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("pruneResolvedDefects returns empty array when queuePath does not exist", async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "prune-test-missing-"));
  const queuePath = path.join(tmpDir, "non-existent-queue.md");
  const archiveDir = path.join(tmpDir, "archive");

  const archived = await pruneResolvedDefects(queuePath, archiveDir);
  assert.equal(archived.length, 0);
  assert.ok(!fs.existsSync(`${queuePath}.lock`));

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("pruneResolvedDefects appends to existing index.json and resolved-defects.md", async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "prune-test-append-"));
  const queuePath = path.join(tmpDir, "queue.md");
  const archiveDir = path.join(tmpDir, "archive");

  const now = new Date();
  const ym = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const monthlyDir = path.join(archiveDir, ym);
  fs.mkdirSync(monthlyDir, { recursive: true });

  const existingEntry: ArchiveIndexEntry = {
    id: "DEV-000",
    signatureHash: "hash-000",
    targetRepo: "sorensencc-dotcom/toolforge",
    blastRadius: "P2",
    firstSeen: "2026-08-01T00:00:00.000Z",
    resolvedAt: "2026-08-01T01:00:00.000Z",
    durationMs: 3600000,
    archiveFile: `${ym}/resolved-defects.md`,
    tags: ["legacy"]
  };
  fs.writeFileSync(path.join(archiveDir, "index.json"), JSON.stringify([existingEntry], null, 2), "utf8");
  fs.writeFileSync(path.join(monthlyDir, "resolved-defects.md"), "# Previous Resolved Defects\n\n### [DEV-000] Old Fix\n", "utf8");

  const items: DefectItem[] = [
    {
      id: "DEV-001",
      signatureHash: "hash-001",
      sourceFingerprint: "fp-001",
      status: "RESOLVED",
      title: "Newly Fixed Defect",
      targetRepo: "sorensencc-dotcom/toolforge",
      failingWorkflows: [],
      blastRadius: "P0",
      primarySuspects: [],
      actionSteps: [],
      sourceId: "src-1",
      firstSeen: "2026-08-28T10:00:00.000Z",
      lastObserved: "2026-08-28T11:00:00.000Z",
      tags: ["ci"]
    }
  ];

  fs.writeFileSync(queuePath, renderQueueMarkdown(items), "utf8");

  const archived = await pruneResolvedDefects(queuePath, archiveDir);
  assert.equal(archived.length, 1);

  const indexData: ArchiveIndexEntry[] = JSON.parse(fs.readFileSync(path.join(archiveDir, "index.json"), "utf8"));
  assert.equal(indexData.length, 2);
  assert.equal(indexData[0].id, "DEV-000");
  assert.equal(indexData[1].id, "DEV-001");

  const mdContent = fs.readFileSync(path.join(monthlyDir, "resolved-defects.md"), "utf8");
  assert.ok(mdContent.includes("### [DEV-000] Old Fix"));
  assert.ok(mdContent.includes("### [DEV-001] Newly Fixed Defect"));

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("pruneResolvedDefects calls client.deleteSource for remote sources", async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "prune-test-client-"));
  const queuePath = path.join(tmpDir, "queue.md");
  const archiveDir = path.join(tmpDir, "archive");

  const deletedSources: string[] = [];
  const mockClient = {
    deleteSource: async (sourceId: string) => {
      deletedSources.push(sourceId);
      return true;
    }
  } as unknown as NotebookLMClient;

  const items: DefectItem[] = [
    {
      id: "DEV-001",
      signatureHash: "hash-001",
      sourceFingerprint: "fp-001",
      status: "RESOLVED",
      title: "Remote Source Defect",
      targetRepo: "sorensencc-dotcom/toolforge",
      failingWorkflows: [],
      blastRadius: "P1",
      primarySuspects: [],
      actionSteps: [],
      sourceId: "remote-source-uuid-123",
      firstSeen: "2026-08-28T10:00:00.000Z",
      lastObserved: "2026-08-28T11:00:00.000Z",
      tags: []
    },
    {
      id: "DEV-002",
      signatureHash: "hash-002",
      sourceFingerprint: "fp-002",
      status: "RESOLVED",
      title: "Another Remote Defect",
      targetRepo: "sorensencc-dotcom/toolforge",
      failingWorkflows: [],
      blastRadius: "P2",
      primarySuspects: [],
      actionSteps: [],
      sourceId: "remote-source-uuid-456",
      firstSeen: "2026-08-28T10:00:00.000Z",
      lastObserved: "2026-08-28T11:00:00.000Z",
      tags: []
    }
  ];

  fs.writeFileSync(queuePath, renderQueueMarkdown(items), "utf8");

  const archived = await pruneResolvedDefects(queuePath, archiveDir, mockClient);
  assert.equal(archived.length, 2);
  assert.deepEqual(deletedSources, ["remote-source-uuid-123", "remote-source-uuid-456"]);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("pruneResolvedDefects calculates durationMs with fallback when firstSeen is missing or invalid", async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "prune-test-duration-"));
  const queuePath = path.join(tmpDir, "queue.md");
  const archiveDir = path.join(tmpDir, "archive");

  const items: DefectItem[] = [
    {
      id: "DEV-001",
      signatureHash: "hash-001",
      sourceFingerprint: "fp-001",
      status: "RESOLVED",
      title: "No FirstSeen Defect",
      targetRepo: "sorensencc-dotcom/toolforge",
      failingWorkflows: [],
      blastRadius: "P3",
      primarySuspects: [],
      actionSteps: [],
      sourceId: "src-1",
      firstSeen: "",
      lastObserved: "2026-08-28T11:00:00.000Z",
      tags: []
    }
  ];

  fs.writeFileSync(queuePath, renderQueueMarkdown(items), "utf8");

  const archived = await pruneResolvedDefects(queuePath, archiveDir);
  assert.equal(archived.length, 1);
  assert.ok(typeof archived[0].durationMs === "number");
  assert.ok(archived[0].durationMs >= 0);
  assert.ok(archived[0].firstSeen.length > 0);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("index.ts re-exports pruneResolvedDefects function", () => {
  assert.equal(typeof trmDevops.pruneResolvedDefects, "function");
});
