import { readdirSync, readFileSync } from "fs";
import { join } from "path";

export interface DriftSignal {
  type: string;
  count: number;
  files: string[];
  keywords: string[];
  sessions_scanned?: number;
}

const DRIFT_KEYWORDS = [
  "drift",
  "driftScore",
  "driftMetrics",
  "semanticVariance",
  "lengthDelta",
  "missingFields",
  "driftRules",
  "driftEngine",
  "drift-engine",
  "drift-detection"
];

export function scanTranscriptsForDrift(
  transcriptRootDir: string,
  _daysBack: number = 7
): DriftSignal {
  const filesSet = new Set<string>();
  const keywordsSet = new Set<string>();
  let count = 0;
  let sessions_scanned = 0;

  try {
    const projects = readdirSync(transcriptRootDir, { withFileTypes: true })
      .filter((d: any) => d.isDirectory())
      .map((d: any) => d.name);

    for (const project of projects) {
      const projectPath = join(transcriptRootDir, project);
      try {
        const files = readdirSync(projectPath);

        for (const file of files) {
          if (!file.endsWith(".jsonl")) continue;

          sessions_scanned++;
          const filePath = join(projectPath, file);
          try {
            const content = readFileSync(filePath, "utf-8");
            const lines = content.split("\n").filter((l: string) => l.trim());

            for (const line of lines) {
              try {
                const json = JSON.parse(line);

                // Check message content for drift keywords
                if (json.message?.content && Array.isArray(json.message.content)) {
                  for (const block of json.message.content) {
                    if (block && block.type === "text" && block.text) {
                      for (const keyword of DRIFT_KEYWORDS) {
                        if (block.text.toLowerCase().includes(keyword)) {
                          count++;
                          filesSet.add(filePath);
                          keywordsSet.add(keyword);
                        }
                      }
                    }
                  }
                }

                // Check tool_use blocks for drift-related operations
                if (json.message?.content && Array.isArray(json.message.content)) {
                  for (const block of json.message.content) {
                    if (
                      block &&
                      block.type === "tool_use" &&
                      block.input?.file_path
                    ) {
                      const toolFilePath = block.input.file_path.toLowerCase();
                      if (toolFilePath.includes("drift")) {
                        count++;
                        filesSet.add(filePath);
                        keywordsSet.add("drift-file-touched");
                      }
                    }
                  }
                }
              } catch {
                // Skip malformed JSON lines
              }
            }
          } catch {
            // Skip files we can't read
          }
        }
      } catch {
        // Skip projects we can't read
      }
    }
  } catch {
    // Return empty signal if root dir doesn't exist
  }

  return {
    type: "drift-signals-detected",
    count,
    files: Array.from(filesSet),
    keywords: Array.from(keywordsSet),
    sessions_scanned,
  };
}

export function detectDriftFromDiffContent(diffContent: string): string[] {
  const keywords: string[] = [];

  for (const keyword of DRIFT_KEYWORDS) {
    if (diffContent.toLowerCase().includes(keyword)) {
      keywords.push(keyword);
    }
  }

  return keywords;
}

export function scoreDriftLikelihood(signals: DriftSignal): number {
  // Simple scoring: 0-1 scale based on evidence
  if (signals.count === 0) return 0;

  const fileCount = signals.files.length;
  const keywordCount = signals.keywords.length;

  // More files touched + more keywords = higher drift likelihood
  const score = Math.min(
    1.0,
    (fileCount / 10) * 0.5 + (keywordCount / DRIFT_KEYWORDS.length) * 0.5
  );

  return Math.round(score * 100) / 100;
}

export function summarizeDriftSignals(signal: DriftSignal): string {
  if (signal.count === 0) {
    return "No drift signals detected";
  }

  const topKeywords = signal.keywords.slice(0, 3).join(", ");
  return `Drift activity detected: ${signal.count} occurrences across ${signal.files.length} files. Keywords: ${topKeywords}`;
}
