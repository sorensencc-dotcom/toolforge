import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { NotebookLMClient } from "../src/core/notebooklm-client.ts";
import * as trmDevops from "../src/index.ts";

test("NotebookLMClient constructor applies default values", () => {
  const defaultClient = new NotebookLMClient();
  assert.equal(defaultClient.notebookId, "cb0498ce-1ea5-4668-9f65-ac368753404e");
  assert.equal(defaultClient.offlineBufferDir, "dev/triage/.cache/pending-sync");

  const customClient = new NotebookLMClient({
    notebookId: "custom-notebook-123",
    offlineBufferDir: "custom/path/buffer",
    endpointUrl: "https://example.com/api"
  });
  assert.equal(customClient.notebookId, "custom-notebook-123");
  assert.equal(customClient.offlineBufferDir, "custom/path/buffer");
});

test("NotebookLMClient stages offline chunk and drains during fetch", async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "fallback-test-"));
  const offlineDir = path.join(tmpDir, "pending-sync");

  const client = new NotebookLMClient({
    notebookId: "test-notebook-id",
    offlineBufferDir: offlineDir
  });

  const payload = {
    signatureHash: "test-offline-hash",
    title: "Offline CI Run Failure",
    targetRepo: "sorensencc-dotcom/toolforge",
    failingWorkflows: [{ name: "Offline Workflow", commitSha: "abcdef" }]
  };

  const stagedFile = client.stageOfflineChunk(payload);

  assert.ok(fs.existsSync(stagedFile));
  const filename = path.basename(stagedFile);
  assert.match(filename, /^\d+-[a-f0-9]+\.json$/);

  const fileContent = JSON.parse(fs.readFileSync(stagedFile, "utf8"));
  assert.deepEqual(fileContent, payload);

  const chunks = await client.drainOfflineBuffer();
  assert.equal(chunks.length, 1);
  assert.equal(chunks[0].signatureHash, "test-offline-hash");
  assert.equal(chunks[0].title, "Offline CI Run Failure");
  assert.equal(fs.existsSync(stagedFile), false);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("NotebookLMClient drainOfflineBuffer returns empty array if directory does not exist", async () => {
  const nonExistentDir = path.join(os.tmpdir(), `non-existent-buffer-${Date.now()}`);
  const client = new NotebookLMClient({ offlineBufferDir: nonExistentDir });

  const chunks = await client.drainOfflineBuffer();
  assert.deepEqual(chunks, []);
});

test("NotebookLMClient stageOfflineChunk handles multiple chunks and drains all", async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "fallback-multi-test-"));
  const offlineDir = path.join(tmpDir, "pending-sync");

  const client = new NotebookLMClient({ offlineBufferDir: offlineDir });

  const payload1 = { signatureHash: "hash-1", title: "Defect 1" };
  const payload2 = { signatureHash: "hash-2", title: "Defect 2" };

  const file1 = client.stageOfflineChunk(payload1);
  const file2 = client.stageOfflineChunk(payload2);

  assert.ok(fs.existsSync(file1));
  assert.ok(fs.existsSync(file2));

  // fetchOperationalChunks drains the offline buffer
  const operationalChunks = await client.fetchOperationalChunks();
  assert.equal(operationalChunks.length, 2);

  const hashes = operationalChunks.map((c) => c.signatureHash).sort();
  assert.deepEqual(hashes, ["hash-1", "hash-2"]);

  assert.equal(fs.existsSync(file1), false);
  assert.equal(fs.existsSync(file2), false);

  // Subsequent fetch returns empty if no new items
  const subsequentChunks = await client.fetchOperationalChunks();
  assert.equal(subsequentChunks.length, 0);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("NotebookLMClient deleteSource gracefully handles LOCAL and remote source IDs", async () => {
  const client = new NotebookLMClient();

  assert.equal(await client.deleteSource("LOCAL"), true);
  assert.equal(await client.deleteSource(""), true);
  assert.equal(await client.deleteSource("src-remote-uuid-1234"), true);
});

test("index.ts re-exports NotebookLMClient", () => {
  assert.equal(typeof trmDevops.NotebookLMClient, "function");
});
