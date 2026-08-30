import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync, spawnSync } from "node:child_process";
import {
  parseCliArgs,
  printHelp,
  handleSync,
  handlePrune,
  handleStatus,
  runCli,
  main
} from "../src/cli/index.ts";
import * as trmDevops from "../src/index.ts";
import { renderQueueMarkdown } from "../src/core/reconciler.ts";
import { NotebookLMClient } from "../src/core/notebooklm-client.ts";
import type { DefectItem } from "../src/core/types.ts";

test("parseCliArgs parses commands and options correctly", () => {
  const res1 = parseCliArgs(["sync", "--dry-run", "--queue", "custom/queue.md", "--archive", "custom/archive", "--buffer", "custom/buf"]);
  assert.equal(res1.command, "sync");
  assert.equal(res1.options.dryRun, true);
  assert.equal(res1.options.queue, "custom/queue.md");
  assert.equal(res1.options.archive, "custom/archive");
  assert.equal(res1.options.buffer, "custom/buf");

  const res2 = parseCliArgs(["prune", "-d", "-q", "q.md", "-a", "arch", "-b", "buf"]);
  assert.equal(res2.command, "prune");
  assert.equal(res2.options.dryRun, true);
  assert.equal(res2.options.queue, "q.md");
  assert.equal(res2.options.archive, "arch");
  assert.equal(res2.options.buffer, "buf");

  const res3 = parseCliArgs(["status"]);
  assert.equal(res3.command, "status");
  assert.equal(res3.options.dryRun, false);

  const res4 = parseCliArgs(["--help"]);
  assert.equal(res4.command, "help");
  assert.equal(res4.options.help, true);

  const res5 = parseCliArgs(["-h"]);
  assert.equal(res5.command, "help");
  assert.equal(res5.options.help, true);
});

test("runCli with help, --help, or -h prints usage and returns 0", async () => {
  const code1 = await runCli(["--help"]);
  assert.equal(code1, 0);

  const code2 = await runCli(["-h"]);
  assert.equal(code2, 0);

  const code3 = await runCli(["help"]);
  assert.equal(code3, 0);

  const code4 = await main(["help"]);
  assert.equal(code4, 0);
});

test("runCli with invalid or missing command returns 1", async () => {
  const code1 = await runCli(["invalid-command"]);
  assert.equal(code1, 1);

  const code2 = await runCli([]);
  assert.equal(code2, 1);
});

test("handleSync drains buffer and reconciles queue", async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cli-sync-test-"));
  const queuePath = path.join(tmpDir, "queue.md");
  const bufferDir = path.join(tmpDir, "pending-sync");

  const client = new NotebookLMClient({ offlineBufferDir: bufferDir });
  client.stageOfflineChunk({
    signatureHash: "hash-cli-1",
    title: "CLI Test Defect",
    targetRepo: "sorensencc-dotcom/toolforge",
    blastRadius: "P1"
  });

  const res = await handleSync({
    queue: queuePath,
    buffer: bufferDir,
    dryRun: false
  });

  assert.equal(res.syncedCount, 1);
  assert.equal(res.totalCount, 1);
  assert.equal(res.quarantinedCount, 0);
  assert.ok(fs.existsSync(queuePath));

  const content = fs.readFileSync(queuePath, "utf8");
  assert.ok(content.includes("[DEV-001] CLI Test Defect"));

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("handleSync dry-run does not write queue file", async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cli-sync-dry-"));
  const queuePath = path.join(tmpDir, "queue.md");
  const bufferDir = path.join(tmpDir, "pending-sync");

  const client = new NotebookLMClient({ offlineBufferDir: bufferDir });
  client.stageOfflineChunk({
    signatureHash: "hash-cli-dry",
    title: "Dry Run Defect",
    targetRepo: "sorensencc-dotcom/toolforge"
  });

  const res = await handleSync({
    queue: queuePath,
    buffer: bufferDir,
    dryRun: true
  });

  assert.equal(res.syncedCount, 1);
  assert.equal(fs.existsSync(queuePath), false);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("handleSync quarantines malformed chunks", async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cli-sync-quarantine-"));
  const queuePath = path.join(tmpDir, "queue.md");
  const bufferDir = path.join(tmpDir, "pending-sync");

  fs.mkdirSync(bufferDir, { recursive: true });
  fs.writeFileSync(path.join(bufferDir, "bad-chunk.json"), JSON.stringify({ invalid: true }), "utf8");

  const res = await handleSync({
    queue: queuePath,
    buffer: bufferDir,
    dryRun: false
  });

  assert.equal(res.syncedCount, 0);
  assert.equal(res.quarantinedCount, 1);

  const quarantineDir = path.join(tmpDir, ".cache", "quarantine");
  assert.ok(fs.existsSync(quarantineDir));
  assert.equal(fs.readdirSync(quarantineDir).length, 1);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("handlePrune prunes resolved defects to archive", async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cli-prune-test-"));
  const queuePath = path.join(tmpDir, "queue.md");
  const archiveDir = path.join(tmpDir, "archive");

  const items: DefectItem[] = [
    {
      id: "DEV-001",
      signatureHash: "hash-resolved",
      sourceFingerprint: "fp-1",
      status: "RESOLVED",
      title: "Resolved Bug",
      targetRepo: "sorensencc-dotcom/toolforge",
      blastRadius: "P2",
      failingWorkflows: [],
      primarySuspects: [],
      actionSteps: [],
      sourceId: "LOCAL",
      firstSeen: "2026-08-28T10:00:00Z",
      lastObserved: "2026-08-28T11:00:00Z",
      tags: []
    },
    {
      id: "DEV-002",
      signatureHash: "hash-open",
      sourceFingerprint: "fp-2",
      status: "OPEN",
      title: "Still Open Bug",
      targetRepo: "sorensencc-dotcom/toolforge",
      blastRadius: "P1",
      failingWorkflows: [],
      primarySuspects: [],
      actionSteps: [],
      sourceId: "LOCAL",
      firstSeen: "2026-08-28T10:00:00Z",
      lastObserved: "2026-08-28T11:00:00Z",
      tags: []
    }
  ];

  fs.writeFileSync(queuePath, renderQueueMarkdown(items), "utf8");

  const pruneDryRes = await handlePrune({
    queue: queuePath,
    archive: archiveDir,
    dryRun: true
  });
  assert.equal(pruneDryRes.prunedCount, 1);
  assert.equal(fs.existsSync(path.join(archiveDir, "index.json")), false);

  const pruneRes = await handlePrune({
    queue: queuePath,
    archive: archiveDir,
    dryRun: false
  });
  assert.equal(pruneRes.prunedCount, 1);
  assert.ok(fs.existsSync(path.join(archiveDir, "index.json")));

  const remaining = fs.readFileSync(queuePath, "utf8");
  assert.ok(!remaining.includes("DEV-001"));
  assert.ok(remaining.includes("DEV-002"));

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("handlePrune on non-existent queue returns prunedCount 0", async () => {
  const res = await handlePrune({
    queue: "non-existent-queue.md",
    archive: "archive-dir",
    dryRun: false
  });
  assert.equal(res.prunedCount, 0);
});

test("handleStatus reports queue and archive summary", async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cli-status-test-"));
  const queuePath = path.join(tmpDir, "queue.md");
  const archiveDir = path.join(tmpDir, "archive");

  const items: DefectItem[] = [
    {
      id: "DEV-001",
      signatureHash: "h1",
      sourceFingerprint: "f1",
      status: "OPEN",
      title: "Open issue",
      targetRepo: "repo",
      blastRadius: "P0",
      failingWorkflows: [],
      primarySuspects: [],
      actionSteps: [],
      sourceId: "LOCAL",
      firstSeen: "2026-08-28T10:00:00Z",
      lastObserved: "2026-08-28T11:00:00Z",
      tags: []
    },
    {
      id: "DEV-002",
      signatureHash: "h2",
      sourceFingerprint: "f2",
      status: "IN_PROGRESS",
      title: "In progress issue",
      targetRepo: "repo",
      blastRadius: "P1",
      failingWorkflows: [],
      primarySuspects: [],
      actionSteps: [],
      sourceId: "LOCAL",
      firstSeen: "2026-08-28T10:00:00Z",
      lastObserved: "2026-08-28T11:00:00Z",
      tags: []
    }
  ];

  fs.writeFileSync(queuePath, renderQueueMarkdown(items), "utf8");

  fs.mkdirSync(archiveDir, { recursive: true });
  fs.writeFileSync(
    path.join(archiveDir, "index.json"),
    JSON.stringify([{ id: "DEV-000", signatureHash: "h0" }]),
    "utf8"
  );

  const statusRes = await handleStatus({
    queue: queuePath,
    archive: archiveDir
  });

  assert.equal(statusRes.queueFound, true);
  assert.equal(statusRes.activeCount, 2);
  assert.equal(statusRes.statusBreakdown.OPEN, 1);
  assert.equal(statusRes.statusBreakdown.IN_PROGRESS, 1);
  assert.equal(statusRes.archivedCount, 1);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("index.ts re-exports CLI functions", () => {
  assert.equal(typeof trmDevops.parseCliArgs, "function");
  assert.equal(typeof trmDevops.printHelp, "function");
  assert.equal(typeof trmDevops.handleSync, "function");
  assert.equal(typeof trmDevops.handlePrune, "function");
  assert.equal(typeof trmDevops.handleStatus, "function");
  assert.equal(typeof trmDevops.runCli, "function");
  assert.equal(typeof trmDevops.main, "function");
});

test("CLI dist executable execution across commands", () => {
  const distCliPath = path.resolve("modules/trm-devops/dist/cli/index.js");
  if (!fs.existsSync(distCliPath)) {
    return;
  }

  // Test --help
  const helpOut = execFileSync(process.execPath, [distCliPath, "--help"], {
    encoding: "utf8"
  });
  assert.ok(helpOut.includes("Usage: trm-devops"));
  assert.ok(helpOut.includes("sync"));
  assert.ok(helpOut.includes("prune"));
  assert.ok(helpOut.includes("status"));

  // Test status
  const statusOut = execFileSync(process.execPath, [distCliPath, "status"], {
    encoding: "utf8"
  });
  assert.ok(statusOut.includes("TRM DevOps Status"));

  // Test sync --dry-run
  const syncOut = execFileSync(process.execPath, [distCliPath, "sync", "--dry-run"], {
    encoding: "utf8"
  });
  assert.ok(syncOut.includes("[DRY RUN]"));

  // Test prune --dry-run
  const pruneOut = execFileSync(process.execPath, [distCliPath, "prune", "--dry-run"], {
    encoding: "utf8"
  });
  assert.ok(pruneOut.includes("prune") || pruneOut.includes("Nothing to prune"));

  // Test invalid command exits with non-zero
  const invalidRun = spawnSync(process.execPath, [distCliPath, "invalid-command-name"], {
    encoding: "utf8"
  });
  assert.equal(invalidRun.status, 1);
  assert.ok(invalidRun.stderr.includes('Unknown command: "invalid-command-name"') || invalidRun.stdout.includes('Unknown command'));
});
