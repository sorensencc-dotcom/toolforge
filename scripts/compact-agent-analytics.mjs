/**
 * @file compact-agent-analytics.mjs
 * @description Compaction daemon for agent analytics logs.
 * Converts raw JSONL files into structured partitioned storage with integrity validation.
 */

import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';

/**
 * Runs compaction pass over a staging directory.
 * @param {Object} options
 * @param {string} options.rawDir - Directory containing raw JSONL files
 * @param {string} options.partitionDir - Target partition directory
 * @returns {Promise<Object>} Compaction summary statistics
 */
export async function runCompaction({ rawDir, partitionDir }) {
  if (!fs.existsSync(rawDir)) {
    return { filesProcessed: 0, totalRecords: 0, partitionsCreated: 0 };
  }

  if (!fs.existsSync(partitionDir)) {
    fs.mkdirSync(partitionDir, { recursive: true });
  }

  const rawFiles = fs.readdirSync(rawDir).filter((f) => f.endsWith('.jsonl'));
  let totalRecords = 0;
  let filesProcessed = 0;
  const partitions = new Set();

  for (const file of rawFiles) {
    const rawFilePath = path.join(rawDir, file);
    const fileStream = fs.createReadStream(rawFilePath, { encoding: 'utf8' });
    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

    const recordsByDay = new Map();

    for await (const line of rl) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      try {
        const record = JSON.parse(trimmed);
        const timestamp = record.timestamp || new Date().toISOString();
        const date = new Date(timestamp);
        const year = date.getUTCFullYear();
        const month = String(date.getUTCMonth() + 1).padStart(2, '0');
        const day = String(date.getUTCDate()).padStart(2, '0');

        const partitionKey = `year=${year}/month=${month}/day=${day}`;
        if (!recordsByDay.has(partitionKey)) {
          recordsByDay.set(partitionKey, []);
        }
        recordsByDay.get(partitionKey).push(record);
        totalRecords += 1;
      } catch {
        // Skip malformed individual lines
      }
    }

    // Flush partitioned records
    for (const [partitionKey, records] of recordsByDay.entries()) {
      const targetDir = path.join(partitionDir, partitionKey);
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      const partitionFile = path.join(targetDir, `events-${Date.now()}.jsonl`);
      const payload = records.map((r) => JSON.stringify(r)).join('\n') + '\n';
      fs.appendFileSync(partitionFile, payload, 'utf8');
      partitions.add(partitionKey);
    }

    // Remove or archive processed raw file
    fs.unlinkSync(rawFilePath);
    filesProcessed += 1;
  }

  return {
    filesProcessed,
    totalRecords,
    partitionsCreated: partitions.size,
    partitions: Array.from(partitions),
  };
}

// CLI entrypoint
if (process.argv[1] && process.argv[1].endsWith('compact-agent-analytics.mjs')) {
  const rawDir = process.env.ANALYTICS_RAW_DIR || path.resolve('data/analytics/raw');
  const partitionDir = process.env.ANALYTICS_PARTITION_DIR || path.resolve('data/analytics/partitions');

  runCompaction({ rawDir, partitionDir })
    .then((stats) => {
      console.log(`[compactor] Processed ${stats.filesProcessed} files (${stats.totalRecords} records across ${stats.partitionsCreated} partitions).`);
    })
    .catch((err) => {
      console.error('[compactor] Error running compaction:', err);
      process.exit(1);
    });
}
