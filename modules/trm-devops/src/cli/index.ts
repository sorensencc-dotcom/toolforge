#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { NotebookLMClient } from "../core/notebooklm-client.ts";
import { validateDefectChunk, quarantineMalformedChunk } from "../core/extractor.ts";
import { reconcileQueue, parseQueueMarkdown } from "../core/reconciler.ts";
import { pruneResolvedDefects } from "../core/pruning.ts";
import type { DefectItem } from "../core/types.ts";

export interface CliOptions {
  queue?: string;
  archive?: string;
  buffer?: string;
  dryRun?: boolean;
  help?: boolean;
}

export function parseCliArgs(rawArgs: string[]): { command: string; options: CliOptions } {
  const optionsConfig = {
    help: { type: "boolean" as const, short: "h" },
    "dry-run": { type: "boolean" as const, short: "d" },
    queue: { type: "string" as const, short: "q" },
    archive: { type: "string" as const, short: "a" },
    buffer: { type: "string" as const, short: "b" }
  };

  const { values, positionals } = parseArgs({
    args: rawArgs,
    options: optionsConfig,
    allowPositionals: true,
    strict: false
  });

  let command = positionals[0] || "";
  if (values.help || rawArgs.includes("--help") || rawArgs.includes("-h")) {
    if (!command || command === "help") {
      command = "help";
    }
  }

  return {
    command,
    options: {
      help: Boolean(values.help),
      dryRun: Boolean(values["dry-run"]),
      queue: typeof values.queue === "string" ? values.queue : undefined,
      archive: typeof values.archive === "string" ? values.archive : undefined,
      buffer: typeof values.buffer === "string" ? values.buffer : undefined
    }
  };
}

export function printHelp(): void {
  const usage = `
Usage: trm-devops <command> [options]

Commands:
  sync      Fetch operational chunks from NotebookLM and reconcile triage queue
  prune     Archive resolved defects and cleanup remote sources
  status    Display current summary of queue and archive
  help      Display this help message

Options:
  -q, --queue <path>     Path to triage queue markdown (default: dev/triage/queue.md)
  -a, --archive <path>   Base directory for defect archive (default: dev/triage/archive)
  -b, --buffer <path>    Directory for offline sync buffer (default: dev/triage/.cache/pending-sync)
  -d, --dry-run          Simulate execution without modifying files
  -h, --help             Display this help message
`.trim();
  console.log(usage);
}

export async function handleSync(options: CliOptions): Promise<{
  syncedCount: number;
  totalCount: number;
  quarantinedCount: number;
}> {
  const queuePath = options.queue ? path.resolve(options.queue) : path.resolve(process.cwd(), "dev/triage/queue.md");
  const bufferDir = options.buffer ? path.resolve(options.buffer) : path.resolve(process.cwd(), "dev/triage/.cache/pending-sync");
  const quarantineDir = path.join(path.dirname(queuePath), ".cache", "quarantine");

  const client = new NotebookLMClient({ offlineBufferDir: bufferDir });
  const rawChunks = await client.fetchOperationalChunks();

  const validItems: DefectItem[] = [];
  let quarantinedCount = 0;

  for (const chunk of rawChunks) {
    const valid = validateDefectChunk(chunk);
    if (valid) {
      validItems.push(valid);
    } else {
      quarantineMalformedChunk(typeof chunk === "string" ? chunk : JSON.stringify(chunk), quarantineDir);
      quarantinedCount++;
    }
  }

  if (options.dryRun) {
    console.log(`[DRY RUN] Would sync ${validItems.length} operational defect item(s) to ${queuePath}`);
    if (quarantinedCount > 0) {
      console.log(`[DRY RUN] Quarantined ${quarantinedCount} malformed chunk(s) to ${quarantineDir}`);
    }
    return { syncedCount: validItems.length, totalCount: validItems.length, quarantinedCount };
  }

  const merged = await reconcileQueue(queuePath, validItems);
  console.log(`Synced ${validItems.length} operational defect item(s). Total in queue: ${merged.length}`);
  if (quarantinedCount > 0) {
    console.log(`Quarantined ${quarantinedCount} malformed chunk(s) to ${quarantineDir}`);
  }
  return { syncedCount: validItems.length, totalCount: merged.length, quarantinedCount };
}

export async function handlePrune(options: CliOptions): Promise<{ prunedCount: number }> {
  const queuePath = options.queue ? path.resolve(options.queue) : path.resolve(process.cwd(), "dev/triage/queue.md");
  const archiveDir = options.archive ? path.resolve(options.archive) : path.resolve(process.cwd(), "dev/triage/archive");
  const bufferDir = options.buffer ? path.resolve(options.buffer) : path.resolve(process.cwd(), "dev/triage/.cache/pending-sync");

  if (!fs.existsSync(queuePath)) {
    console.log(`Queue file not found at ${queuePath}. Nothing to prune.`);
    return { prunedCount: 0 };
  }

  if (options.dryRun) {
    const content = fs.readFileSync(queuePath, "utf8");
    const items = parseQueueMarkdown(content);
    const resolved = items.filter((i) => i.status === "RESOLVED");
    console.log(`[DRY RUN] Would prune ${resolved.length} resolved defect(s) from ${queuePath} to ${archiveDir}`);
    return { prunedCount: resolved.length };
  }

  const client = new NotebookLMClient({ offlineBufferDir: bufferDir });
  const archived = await pruneResolvedDefects(queuePath, archiveDir, client);
  console.log(`Pruned and archived ${archived.length} resolved defect(s) to ${archiveDir}`);
  return { prunedCount: archived.length };
}

export async function handleStatus(options: CliOptions): Promise<{
  queueFound: boolean;
  activeCount: number;
  statusBreakdown: Record<string, number>;
  archivedCount: number;
}> {
  const queuePath = options.queue ? path.resolve(options.queue) : path.resolve(process.cwd(), "dev/triage/queue.md");
  const archiveDir = options.archive ? path.resolve(options.archive) : path.resolve(process.cwd(), "dev/triage/archive");
  const indexPath = path.join(archiveDir, "index.json");

  let queueFound = false;
  let activeCount = 0;
  const statusBreakdown: Record<string, number> = {
    OPEN: 0,
    IN_PROGRESS: 0,
    RESOLVED: 0,
    MUTED: 0
  };

  console.log(`\n=== TRM DevOps Status ===`);
  if (fs.existsSync(queuePath)) {
    queueFound = true;
    const content = fs.readFileSync(queuePath, "utf8");
    const items = parseQueueMarkdown(content);
    activeCount = items.length;
    for (const item of items) {
      if (item.status in statusBreakdown) {
        statusBreakdown[item.status]++;
      } else {
        statusBreakdown[item.status] = 1;
      }
    }
    console.log(`Queue: ${queuePath}`);
    console.log(`Active Defects: ${activeCount}`);
    console.log(`  - OPEN:        ${statusBreakdown.OPEN || 0}`);
    console.log(`  - IN_PROGRESS: ${statusBreakdown.IN_PROGRESS || 0}`);
    console.log(`  - RESOLVED:    ${statusBreakdown.RESOLVED || 0}`);
    console.log(`  - MUTED:       ${statusBreakdown.MUTED || 0}`);
  } else {
    console.log(`Queue: Not found (${queuePath})`);
  }

  let archivedCount = 0;
  if (fs.existsSync(indexPath)) {
    try {
      const raw = fs.readFileSync(indexPath, "utf8");
      const entries = JSON.parse(raw);
      if (Array.isArray(entries)) {
        archivedCount = entries.length;
      }
    } catch {}
  }
  console.log(`Archive: ${archivedCount} entries (${archiveDir})`);
  console.log(`=========================\n`);

  return { queueFound, activeCount, statusBreakdown, archivedCount };
}

export async function runCli(rawArgs: string[] = process.argv.slice(2)): Promise<number> {
  const { command, options } = parseCliArgs(rawArgs);

  if (options.help || command === "help" || command === "--help" || command === "-h") {
    printHelp();
    return 0;
  }

  switch (command) {
    case "sync":
      await handleSync(options);
      return 0;
    case "prune":
      await handlePrune(options);
      return 0;
    case "status":
      await handleStatus(options);
      return 0;
    case "":
      printHelp();
      return 1;
    default:
      console.error(`Unknown command: "${command}"`);
      printHelp();
      return 1;
  }
}

export async function main(args?: string[]): Promise<number> {
  return runCli(args);
}

const currentFilePath = fileURLToPath(import.meta.url);
const executedFilePath = process.argv[1] ? path.resolve(process.argv[1]) : "";

if (
  executedFilePath &&
  (executedFilePath === currentFilePath ||
    executedFilePath.endsWith("trm-devops") ||
    executedFilePath.endsWith("trm-devops.cmd") ||
    executedFilePath.endsWith("trm-devops.ps1"))
) {
  runCli().then((code) => {
    if (code !== 0) {
      process.exit(code);
    }
  }).catch((err) => {
    console.error("Fatal error executing CLI:", err);
    process.exit(1);
  });
}
