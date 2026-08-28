import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { reconcileQueue } from "../core/reconciler.ts";
import { pruneResolvedDefects } from "../core/pruning.ts";
import { NotebookLMClient } from "../core/notebooklm-client.ts";
import { validateDefectChunk, quarantineMalformedChunk } from "../core/extractor.ts";
import type { DefectItem } from "../core/types.ts";

export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, any>;
    required?: string[];
  };
}

export interface McpServerOptions {
  name?: string;
  version?: string;
  queuePath?: string;
  archiveDir?: string;
  offlineBufferDir?: string;
  notebookId?: string;
}

export function getMcpTools(): McpToolDefinition[] {
  return [
    {
      name: "sync_dev_triage",
      description: "Syncs operational diagnostic chunks into dev/triage/queue.md",
      inputSchema: {
        type: "object",
        properties: {
          dryRun: {
            type: "boolean",
            description: "Simulate sync without modifying queue files"
          },
          queuePath: {
            type: "string",
            description: "Path to triage queue markdown file (default: dev/triage/queue.md)"
          },
          archiveDir: {
            type: "string",
            description: "Base directory for defect archive (default: dev/triage/archive)"
          },
          offlineBufferDir: {
            type: "string",
            description: "Directory for offline sync buffer (default: dev/triage/.cache/pending-sync)"
          }
        }
      }
    },
    {
      name: "prune_triage_source",
      description: "Prunes resolved defect items and updates archive index.json",
      inputSchema: {
        type: "object",
        properties: {
          defectId: {
            type: "string",
            description: "Optional specific defect ID to prune"
          },
          queuePath: {
            type: "string",
            description: "Path to triage queue markdown file (default: dev/triage/queue.md)"
          },
          archiveDir: {
            type: "string",
            description: "Base directory for defect archive (default: dev/triage/archive)"
          }
        }
      }
    },
    {
      name: "query_dev_notebook",
      description: "Directly queries the operational NotebookLM buffer for defect traces",
      inputSchema: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Search query or error snippet"
          },
          notebookId: {
            type: "string",
            description: "Optional notebook ID to target"
          },
          offlineBufferDir: {
            type: "string",
            description: "Directory for offline sync buffer (default: dev/triage/.cache/pending-sync)"
          }
        },
        required: ["query"]
      }
    }
  ];
}

export function createMcpServer(options: McpServerOptions = {}): Server {
  const server = new Server(
    {
      name: options.name || "trm-devops-mcp",
      version: options.version || "1.0.0"
    },
    {
      capabilities: {
        tools: {}
      }
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools: getMcpTools() };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    if (name === "sync_dev_triage") {
      const dryRun = Boolean(args?.dryRun);
      const queuePath =
        typeof args?.queuePath === "string" && args.queuePath
          ? path.resolve(args.queuePath)
          : options.queuePath
            ? path.resolve(options.queuePath)
            : path.resolve(process.cwd(), "dev/triage/queue.md");
      const bufferDir =
        typeof args?.offlineBufferDir === "string" && args.offlineBufferDir
          ? path.resolve(args.offlineBufferDir)
          : options.offlineBufferDir
            ? path.resolve(options.offlineBufferDir)
            : path.resolve(process.cwd(), "dev/triage/.cache/pending-sync");
      const notebookId =
        typeof args?.notebookId === "string" && args.notebookId
          ? args.notebookId
          : options.notebookId;
      const quarantineDir = path.join(path.dirname(queuePath), ".cache", "quarantine");

      const client = new NotebookLMClient({ offlineBufferDir: bufferDir, notebookId });
      const rawChunks = await client.fetchOperationalChunks();

      const validItems: DefectItem[] = [];
      let quarantinedCount = 0;

      for (const chunk of rawChunks) {
        const valid = validateDefectChunk(chunk);
        if (valid) {
          validItems.push(valid);
        } else {
          quarantineMalformedChunk(
            typeof chunk === "string" ? chunk : JSON.stringify(chunk),
            quarantineDir
          );
          quarantinedCount++;
        }
      }

      if (dryRun) {
        return {
          content: [
            {
              type: "text",
              text: `[DRY RUN] Would sync ${validItems.length} operational defect item(s) to ${queuePath}${
                quarantinedCount > 0 ? ` (Quarantined ${quarantinedCount} malformed chunk(s))` : ""
              }`
            }
          ]
        };
      }

      const merged = await reconcileQueue(queuePath, validItems);
      return {
        content: [
          {
            type: "text",
            text: `Synced ${validItems.length} operational defect item(s). Total in queue: ${merged.length}${
              quarantinedCount > 0 ? ` (Quarantined ${quarantinedCount} malformed chunk(s))` : ""
            }`
          }
        ]
      };
    }

    if (name === "prune_triage_source") {
      const queuePath =
        typeof args?.queuePath === "string" && args.queuePath
          ? path.resolve(args.queuePath)
          : options.queuePath
            ? path.resolve(options.queuePath)
            : path.resolve(process.cwd(), "dev/triage/queue.md");
      const archiveDir =
        typeof args?.archiveDir === "string" && args.archiveDir
          ? path.resolve(args.archiveDir)
          : options.archiveDir
            ? path.resolve(options.archiveDir)
            : path.resolve(process.cwd(), "dev/triage/archive");
      const bufferDir =
        typeof args?.offlineBufferDir === "string" && args.offlineBufferDir
          ? path.resolve(args.offlineBufferDir)
          : options.offlineBufferDir
            ? path.resolve(options.offlineBufferDir)
            : path.resolve(process.cwd(), "dev/triage/.cache/pending-sync");
      const defectId = typeof args?.defectId === "string" ? args.defectId : undefined;

      if (!fs.existsSync(queuePath)) {
        return {
          content: [
            {
              type: "text",
              text: `Queue file not found at ${queuePath}. Nothing to prune.`
            }
          ]
        };
      }

      const client = new NotebookLMClient({ offlineBufferDir: bufferDir });
      const archived = await pruneResolvedDefects(queuePath, archiveDir, client);

      return {
        content: [
          {
            type: "text",
            text: `Archived ${archived.length} resolved defect(s) to ${archiveDir}${
              defectId ? ` (Target defectId: ${defectId})` : ""
            }.`
          }
        ]
      };
    }

    if (name === "query_dev_notebook") {
      const queryStr = String(args?.query || "");
      const bufferDir =
        typeof args?.offlineBufferDir === "string" && args.offlineBufferDir
          ? path.resolve(args.offlineBufferDir)
          : options.offlineBufferDir
            ? path.resolve(options.offlineBufferDir)
            : path.resolve(process.cwd(), "dev/triage/.cache/pending-sync");

      let matches = 0;
      const matchedItems: any[] = [];

      if (fs.existsSync(bufferDir)) {
        const files = fs.readdirSync(bufferDir).filter((f) => f.endsWith(".json"));
        for (const file of files) {
          try {
            const raw = fs.readFileSync(path.join(bufferDir, file), "utf8");
            if (raw.toLowerCase().includes(queryStr.toLowerCase())) {
              matches++;
              matchedItems.push(JSON.parse(raw));
            }
          } catch {}
        }
      }

      const details = matchedItems.length > 0 ? `\n${JSON.stringify(matchedItems, null, 2)}` : "";
      return {
        content: [
          {
            type: "text",
            text: `Query executed for "${queryStr}" (${matches} match(es) in buffer).${details}`
          }
        ]
      };
    }

    throw new Error(`Unknown tool: ${name}`);
  });

  return server;
}

const currentFilePath = fileURLToPath(import.meta.url);
const executedFilePath = process.argv[1] ? path.resolve(process.argv[1]) : "";

if (
  executedFilePath &&
  (executedFilePath === currentFilePath ||
    executedFilePath.endsWith("server.js") ||
    executedFilePath.endsWith("server.ts") ||
    executedFilePath.endsWith("mcp-server") ||
    executedFilePath.endsWith("mcp-server.cmd") ||
    executedFilePath.endsWith("mcp-server.ps1"))
) {
  const server = createMcpServer();
  const transport = new StdioServerTransport();
  server.connect(transport).catch((err) => {
    console.error("Fatal error starting MCP server:", err);
    process.exit(1);
  });
}
