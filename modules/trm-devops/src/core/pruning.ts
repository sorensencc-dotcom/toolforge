import fs from "node:fs";
import path from "node:path";
import type { ArchiveIndexEntry, DefectItem } from "./types.ts";
import { parseQueueMarkdown, renderQueueMarkdown } from "./reconciler.ts";
import { FileLock } from "./lock.ts";
import type { NotebookLMClient } from "./notebooklm-client.ts";

export async function pruneResolvedDefects(
  queuePath: string,
  archiveBaseDir: string,
  client?: NotebookLMClient
): Promise<ArchiveIndexEntry[]> {
  const lock = new FileLock(queuePath);
  await lock.acquire();

  try {
    if (!fs.existsSync(queuePath)) {
      return [];
    }

    const fileContent = fs.readFileSync(queuePath, "utf8");
    const items: DefectItem[] = parseQueueMarkdown(fileContent);

    const resolved = items.filter((i) => i.status === "RESOLVED");
    const active = items.filter((i) => i.status !== "RESOLVED");

    if (resolved.length === 0) {
      return [];
    }

    const now = new Date();
    const ym = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
    const monthlyDir = path.join(archiveBaseDir, ym);
    fs.mkdirSync(monthlyDir, { recursive: true });

    const archiveFilePath = path.join(monthlyDir, "resolved-defects.md");
    const indexPath = path.join(archiveBaseDir, "index.json");

    let existingIndex: ArchiveIndexEntry[] = [];
    if (fs.existsSync(indexPath)) {
      try {
        const rawIndex = fs.readFileSync(indexPath, "utf8");
        existingIndex = JSON.parse(rawIndex);
        if (!Array.isArray(existingIndex)) {
          existingIndex = [];
        }
      } catch {
        existingIndex = [];
      }
    }

    const newIndexEntries: ArchiveIndexEntry[] = [];
    let archiveMdAppend = `\n## Archived Batch: ${now.toISOString()}\n\n`;

    for (const item of resolved) {
      const resolvedAt = now.toISOString();

      let firstSeenMs: number;
      if (item.firstSeen && !isNaN(Date.parse(item.firstSeen))) {
        firstSeenMs = Date.parse(item.firstSeen);
      } else {
        let fileStatBirthtime: number | undefined;
        try {
          const stats = fs.statSync(queuePath);
          if (stats.birthtimeMs && stats.birthtimeMs > 0) {
            fileStatBirthtime = stats.birthtimeMs;
          }
        } catch {}
        firstSeenMs = fileStatBirthtime ?? (now.getTime() - 3600000);
      }

      const durationMs = Math.max(0, now.getTime() - firstSeenMs);
      const recordedFirstSeen =
        item.firstSeen && !isNaN(Date.parse(item.firstSeen))
          ? item.firstSeen
          : new Date(firstSeenMs).toISOString();

      const entry: ArchiveIndexEntry = {
        id: item.id,
        signatureHash: item.signatureHash,
        parentHash: item.parentHash,
        targetRepo: item.targetRepo,
        blastRadius: item.blastRadius,
        firstSeen: recordedFirstSeen,
        resolvedAt: resolvedAt,
        durationMs: durationMs,
        archiveFile: path.relative(archiveBaseDir, archiveFilePath).replace(/\\/g, "/"),
        triageOwner: item.triageOwner,
        tags: item.tags || []
      };

      newIndexEntries.push(entry);

      archiveMdAppend += `### [${item.id}] ${item.title}\n`;
      archiveMdAppend += `- **Resolved At:** ${resolvedAt}\n`;
      archiveMdAppend += `- **Duration:** ${durationMs}ms\n`;
      archiveMdAppend += `- **Signature:** \`${item.signatureHash}\`\n\n`;

      if (client && item.sourceId) {
        await client.deleteSource(item.sourceId);
      }
    }

    fs.appendFileSync(archiveFilePath, archiveMdAppend, "utf8");
    fs.writeFileSync(
      indexPath,
      JSON.stringify([...existingIndex, ...newIndexEntries], null, 2),
      "utf8"
    );

    const rendered = renderQueueMarkdown(active, now);
    const tmpPath = `${queuePath}.tmp`;
    fs.writeFileSync(tmpPath, rendered, "utf8");
    fs.renameSync(tmpPath, queuePath);

    return newIndexEntries;
  } finally {
    lock.release();
  }
}
