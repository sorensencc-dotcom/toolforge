import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { getMcpTools, createMcpServer } from "../src/mcp/server.ts";
import * as trmDevops from "../src/index.ts";
import { NotebookLMClient } from "../src/core/notebooklm-client.ts";
import { renderQueueMarkdown } from "../src/core/reconciler.ts";
import type { DefectItem } from "../src/core/types.ts";

test("getMcpTools returns valid tool schemas with expected tools", () => {
  const tools = getMcpTools();
  assert.equal(tools.length, 3);

  const toolNames = tools.map((t) => t.name);
  assert.ok(toolNames.includes("sync_dev_triage"));
  assert.ok(toolNames.includes("prune_triage_source"));
  assert.ok(toolNames.includes("query_dev_notebook"));

  const syncTool = tools.find((t) => t.name === "sync_dev_triage");
  assert.ok(syncTool);
  assert.ok(syncTool.description.length > 0);
  assert.equal(syncTool.inputSchema.type, "object");
  assert.ok(syncTool.inputSchema.properties.dryRun);
  assert.ok(syncTool.inputSchema.properties.queuePath);
  assert.ok(syncTool.inputSchema.properties.archiveDir);
  assert.ok(syncTool.inputSchema.properties.offlineBufferDir);

  const pruneTool = tools.find((t) => t.name === "prune_triage_source");
  assert.ok(pruneTool);
  assert.ok(pruneTool.description.length > 0);
  assert.equal(pruneTool.inputSchema.type, "object");
  assert.ok(pruneTool.inputSchema.properties.defectId);
  assert.ok(pruneTool.inputSchema.properties.queuePath);
  assert.ok(pruneTool.inputSchema.properties.archiveDir);

  const queryTool = tools.find((t) => t.name === "query_dev_notebook");
  assert.ok(queryTool);
  assert.ok(queryTool.description.length > 0);
  assert.equal(queryTool.inputSchema.type, "object");
  assert.ok(queryTool.inputSchema.properties.query);
  assert.ok(queryTool.inputSchema.properties.notebookId);
  assert.deepEqual(queryTool.inputSchema.required, ["query"]);
});

test("createMcpServer initializes server and responds to ListToolsRequest", async () => {
  const server = createMcpServer();
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await server.connect(serverTransport);
  const client = new Client({ name: "test-mcp-client", version: "1.0.0" }, { capabilities: {} });
  await client.connect(clientTransport);

  const listRes = await client.listTools();
  assert.equal(listRes.tools.length, 3);
  const toolNames = listRes.tools.map((t) => t.name);
  assert.ok(toolNames.includes("sync_dev_triage"));
  assert.ok(toolNames.includes("prune_triage_source"));
  assert.ok(toolNames.includes("query_dev_notebook"));

  await client.close();
  await server.close();
});

test("MCP tool sync_dev_triage dry-run simulates sync without writing queue file", async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-sync-dry-"));
  const queuePath = path.join(tmpDir, "queue.md");
  const bufferDir = path.join(tmpDir, "pending-sync");

  const clientHelper = new NotebookLMClient({ offlineBufferDir: bufferDir });
  clientHelper.stageOfflineChunk({
    signatureHash: "hash-mcp-dry-1",
    title: "MCP Dry Run Defect",
    targetRepo: "sorensencc-dotcom/toolforge",
    blastRadius: "P2"
  });

  const server = createMcpServer({
    queuePath,
    offlineBufferDir: bufferDir
  });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);

  const client = new Client({ name: "test-mcp-client", version: "1.0.0" }, { capabilities: {} });
  await client.connect(clientTransport);

  const dryRes = await client.callTool({
    name: "sync_dev_triage",
    arguments: {
      dryRun: true,
      queuePath,
      offlineBufferDir: bufferDir
    }
  });

  assert.ok(Array.isArray(dryRes.content));
  const dryText = (dryRes.content[0] as { type: string; text: string }).text;
  assert.ok(dryText.includes("[DRY RUN]"));
  assert.ok(dryText.includes("Would sync 1 operational defect item(s)"));
  assert.equal(fs.existsSync(queuePath), false);

  await client.close();
  await server.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("MCP tool sync_dev_triage drains buffer and reconciles defects into queue", async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-sync-real-"));
  const queuePath = path.join(tmpDir, "queue.md");
  const bufferDir = path.join(tmpDir, "pending-sync");

  const clientHelper = new NotebookLMClient({ offlineBufferDir: bufferDir });
  clientHelper.stageOfflineChunk({
    signatureHash: "hash-mcp-sync-1",
    title: "MCP Sync Defect",
    targetRepo: "sorensencc-dotcom/toolforge",
    blastRadius: "P1"
  });

  const server = createMcpServer({
    queuePath,
    offlineBufferDir: bufferDir
  });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);

  const client = new Client({ name: "test-mcp-client", version: "1.0.0" }, { capabilities: {} });
  await client.connect(clientTransport);

  const syncRes = await client.callTool({
    name: "sync_dev_triage",
    arguments: {
      dryRun: false,
      queuePath,
      offlineBufferDir: bufferDir
    }
  });

  assert.ok(Array.isArray(syncRes.content));
  const syncText = (syncRes.content[0] as { type: string; text: string }).text;
  assert.ok(syncText.includes("Synced 1 operational defect item(s)"));
  assert.ok(fs.existsSync(queuePath));

  const content = fs.readFileSync(queuePath, "utf8");
  assert.ok(content.includes("[DEV-001] MCP Sync Defect"));

  await client.close();
  await server.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("MCP tool prune_triage_source archives resolved defects", async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-prune-test-"));
  const queuePath = path.join(tmpDir, "queue.md");
  const archiveDir = path.join(tmpDir, "archive");

  const items: DefectItem[] = [
    {
      id: "DEV-001",
      signatureHash: "hash-mcp-resolved",
      sourceFingerprint: "fp-mcp-1",
      status: "RESOLVED",
      title: "MCP Resolved Issue",
      targetRepo: "sorensencc-dotcom/toolforge",
      blastRadius: "P2",
      failingWorkflows: [],
      primarySuspects: [],
      actionSteps: [],
      sourceId: "LOCAL",
      firstSeen: "2026-08-28T10:00:00Z",
      lastObserved: "2026-08-28T11:00:00Z",
      tags: ["mcp"]
    },
    {
      id: "DEV-002",
      signatureHash: "hash-mcp-open",
      sourceFingerprint: "fp-mcp-2",
      status: "OPEN",
      title: "MCP Open Issue",
      targetRepo: "sorensencc-dotcom/toolforge",
      blastRadius: "P1",
      failingWorkflows: [],
      primarySuspects: [],
      actionSteps: [],
      sourceId: "LOCAL",
      firstSeen: "2026-08-28T10:00:00Z",
      lastObserved: "2026-08-28T11:00:00Z",
      tags: ["mcp"]
    }
  ];

  fs.writeFileSync(queuePath, renderQueueMarkdown(items), "utf8");

  const server = createMcpServer({
    queuePath,
    archiveDir
  });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);

  const client = new Client({ name: "test-mcp-client", version: "1.0.0" }, { capabilities: {} });
  await client.connect(clientTransport);

  const pruneRes = await client.callTool({
    name: "prune_triage_source",
    arguments: {
      queuePath,
      archiveDir,
      defectId: "DEV-001"
    }
  });

  assert.ok(Array.isArray(pruneRes.content));
  const pruneText = (pruneRes.content[0] as { type: string; text: string }).text;
  assert.ok(pruneText.includes("Archived 1 resolved defect(s)"));
  assert.ok(fs.existsSync(path.join(archiveDir, "index.json")));

  const queueContent = fs.readFileSync(queuePath, "utf8");
  assert.ok(!queueContent.includes("DEV-001"));
  assert.ok(queueContent.includes("DEV-002"));

  await client.close();
  await server.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("MCP tool prune_triage_source handles missing queue file gracefully", async () => {
  const server = createMcpServer();
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);

  const client = new Client({ name: "test-mcp-client", version: "1.0.0" }, { capabilities: {} });
  await client.connect(clientTransport);

  const pruneRes = await client.callTool({
    name: "prune_triage_source",
    arguments: {
      queuePath: "non-existent-queue-mcp.md",
      archiveDir: "non-existent-archive"
    }
  });

  assert.ok(Array.isArray(pruneRes.content));
  const pruneText = (pruneRes.content[0] as { type: string; text: string }).text;
  assert.ok(pruneText.includes("Nothing to prune") || pruneText.includes("Queue file not found"));

  await client.close();
  await server.close();
});

test("MCP tool query_dev_notebook searches offline buffer for queries", async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-query-test-"));
  const bufferDir = path.join(tmpDir, "pending-sync");

  const clientHelper = new NotebookLMClient({ offlineBufferDir: bufferDir });
  clientHelper.stageOfflineChunk({
    signatureHash: "hash-error-xyz",
    title: "SyntaxError in Build Step",
    targetRepo: "sorensencc-dotcom/toolforge",
    blastRadius: "P0"
  });

  const server = createMcpServer({
    offlineBufferDir: bufferDir
  });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);

  const client = new Client({ name: "test-mcp-client", version: "1.0.0" }, { capabilities: {} });
  await client.connect(clientTransport);

  // Query with match
  const matchRes = await client.callTool({
    name: "query_dev_notebook",
    arguments: {
      query: "SyntaxError",
      offlineBufferDir: bufferDir
    }
  });
  assert.ok(Array.isArray(matchRes.content));
  const matchText = (matchRes.content[0] as { type: string; text: string }).text;
  assert.ok(matchText.includes("1 match(es) in buffer"));
  assert.ok(matchText.includes("SyntaxError"));

  // Query with no match
  const noMatchRes = await client.callTool({
    name: "query_dev_notebook",
    arguments: {
      query: "NonExistentErrorString",
      offlineBufferDir: bufferDir
    }
  });
  assert.ok(Array.isArray(noMatchRes.content));
  const noMatchText = (noMatchRes.content[0] as { type: string; text: string }).text;
  assert.ok(noMatchText.includes("0 matches in buffer") || noMatchText.includes("0 match(es) in buffer"));

  await client.close();
  await server.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("MCP server rejects unknown tool calls", async () => {
  const server = createMcpServer();
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);

  const client = new Client({ name: "test-mcp-client", version: "1.0.0" }, { capabilities: {} });
  await client.connect(clientTransport);

  await assert.rejects(
    async () => {
      await client.callTool({
        name: "unknown_random_tool",
        arguments: {}
      });
    },
    (err: any) => {
      assert.ok(err.message.includes("Unknown tool") || err.message.includes("unknown_random_tool"));
      return true;
    }
  );

  await client.close();
  await server.close();
});

test("index.ts re-exports getMcpTools and createMcpServer", () => {
  assert.equal(typeof (trmDevops as any).getMcpTools, "function");
  assert.equal(typeof (trmDevops as any).createMcpServer, "function");
});

test("dist/index.js and dist/mcp/server.js export expected MCP functions when built", async () => {
  const distServerPath = path.resolve("modules/trm-devops/dist/mcp/server.js");
  if (!fs.existsSync(distServerPath)) {
    return;
  }
  const distMcp = await import(distServerPath);
  assert.equal(typeof distMcp.getMcpTools, "function");
  assert.equal(typeof distMcp.createMcpServer, "function");

  const tools = distMcp.getMcpTools();
  assert.equal(tools.length, 3);
});

