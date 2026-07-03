import { readdirSync, readFileSync, existsSync } from "fs";
import { join } from "path";

export interface TranscriptExcerpt {
  subsystem: string;
  source: "ClaudeCode" | "CICSession" | "OperatorNote";
  excerpt: string;
  timestamp: string;
  reasoning_summary?: string;
}

const MECHANICAL_ONLY_PATTERNS = [
  /^(fix|update|add|remove|rename|refactor) (typo|comment|variable|const|type|import|export)/i,
  /^(merge|rebase|cherry-pick|pull|push|commit)/i,
  /^formatting.*only/i,
  /^whitespace.*only/i,
  /^\s*(\/\/|#).*TODO|FIXME|XXX/i
];

function isMechanicalOnly(text: string): boolean {
  const cleaned = text.trim().toLowerCase();
  if (cleaned.length < 20) return true; // Too short to carry reasoning
  return MECHANICAL_ONLY_PATTERNS.some(pat => pat.test(text));
}

function findMatchingCategories(text: string, categoryNames: string[]): string[] {
  const lower = text.toLowerCase();
  return categoryNames.filter(cat => lower.includes(cat.toLowerCase()));
}

export function extractTranscriptExcerpts(
  transcriptsRoot: string,
  changedFiles: string[],
  activeCategories: string[]
): TranscriptExcerpt[] {
  const excerpts: TranscriptExcerpt[] = [];

  if (!existsSync(transcriptsRoot)) return excerpts;

  const changedFileSet = new Set(
    changedFiles.map(f => f.toLowerCase().split("\\").pop())
  );

  try {
    const projects = readdirSync(transcriptsRoot);
    for (const project of projects) {
      const projectPath = join(transcriptsRoot, project);
      if (!existsSync(projectPath) || projectPath.includes("node_modules"))
        continue;

      const sessions = readdirSync(projectPath).filter(
        f => f.endsWith(".jsonl") && f.includes("session")
      );

      for (const session of sessions) {
        const sessionPath = join(projectPath, session);
        try {
          const content = readFileSync(sessionPath, "utf-8");
          const lines = content.split("\n").filter(l => l.trim());

          for (const line of lines) {
            try {
              const entry = JSON.parse(line);
              if (!entry.content || typeof entry.content !== "string")
                continue;

              const text = entry.content;
              if (isMechanicalOnly(text)) continue;

              const matches = findMatchingCategories(text, activeCategories);
              if (matches.length === 0) continue;

              // Extract subsystem (use first matching category)
              const subsystem = matches[0];

              // Skip very long excerpts (likely code dumps)
              const wordCount = text.split(/\s+/).length;
              if (wordCount > 200) continue;

              excerpts.push({
                subsystem,
                source: "ClaudeCode", // Default; could enhance to detect CICSession vs OperatorNote
                excerpt: text.slice(0, 300), // Truncate for safety
                timestamp: entry.timestamp ?? new Date().toISOString()
              });
            } catch {
              // Skip malformed JSON lines
            }
          }
        } catch {
          // Skip unreadable session files
        }
      }
    }
  } catch {
    // Silently handle missing/unreadable transcripts root
  }

  // Return at most 3 excerpts per subsystem
  const bySubsystem = new Map<string, TranscriptExcerpt[]>();
  for (const exc of excerpts) {
    if (!bySubsystem.has(exc.subsystem)) {
      bySubsystem.set(exc.subsystem, []);
    }
    const list = bySubsystem.get(exc.subsystem)!;
    if (list.length < 3) {
      list.push(exc);
    }
  }

  return Array.from(bySubsystem.values()).flat();
}
