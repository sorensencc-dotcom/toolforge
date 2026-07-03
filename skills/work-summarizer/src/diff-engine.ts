import { execSync } from "child_process";

export interface DiffEntry {
  file: string;
  additions: number;
  deletions: number;
  status: "added" | "modified" | "deleted" | "renamed";
}

export interface DiffContext {
  added_functions: string[];
  removed_functions: string[];
  modified_functions: string[];
  added_classes: string[];
  removed_classes: string[];
  modified_classes: string[];
  config_changes: string[];
  schema_changes: string[];
}

export function getDiffStat(repoPath: string): DiffEntry[] {
  try {
    const output = execSync(`cd "${repoPath}" && git diff --stat`, {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"]
    });

    return parseDiffStat(output);
  } catch {
    return [];
  }
}

export function parseDiffStat(output: string): DiffEntry[] {
  const lines = output.split("\n").filter(l => l.trim());
  const entries: DiffEntry[] = [];

  for (const line of lines) {
    // Format: "path/to/file | 5 ++"
    const match = line.match(/^(.+?)\s+\|\s+(\d+)\s*(.*)$/);
    if (!match) continue;

    const [, file, changes, indicators] = match;
    const additions = (indicators.match(/\+/g) || []).length;
    const deletions = (indicators.match(/-/g) || []).length;

    let status: DiffEntry["status"] = "modified";
    if (file.includes(" => ")) {
      status = "renamed";
    }

    entries.push({
      file: file.trim(),
      additions,
      deletions,
      status
    });
  }

  return entries;
}

export function getFileDiff(repoPath: string, filePath: string): string {
  try {
    const output = execSync(
      `cd "${repoPath}" && git diff HEAD -- "${filePath}"`,
      {
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"]
      }
    );
    return output;
  } catch {
    return "";
  }
}

export function extractContextFromDiff(diff: string): DiffContext {
  const context: DiffContext = {
    added_functions: [],
    removed_functions: [],
    modified_functions: [],
    added_classes: [],
    removed_classes: [],
    modified_classes: [],
    config_changes: [],
    schema_changes: []
  };

  const lines = diff.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Added function: +export function name( or +function name(
    if (line.match(/^\+\s*(export\s+)?(async\s+)?function\s+(\w+)/)) {
      const match = line.match(/function\s+(\w+)/);
      if (match) context.added_functions.push(match[1]);
    }

    // Removed function: -export function name( or -function name(
    if (line.match(/^-\s*(export\s+)?(async\s+)?function\s+(\w+)/)) {
      const match = line.match(/function\s+(\w+)/);
      if (match) context.removed_functions.push(match[1]);
    }

    // Added class: +export class Name
    if (line.match(/^\+\s*export\s+class\s+(\w+)/)) {
      const match = line.match(/class\s+(\w+)/);
      if (match) context.added_classes.push(match[1]);
    }

    // Removed class: -export class Name
    if (line.match(/^-\s*export\s+class\s+(\w+)/)) {
      const match = line.match(/class\s+(\w+)/);
      if (match) context.removed_classes.push(match[1]);
    }

    // Config changes
    if (
      line.includes(".json") ||
      line.includes(".yaml") ||
      line.includes(".yml") ||
      line.includes(".env")
    ) {
      context.config_changes.push(line.trim());
    }

    // Schema changes
    if (
      line.includes("CREATE TABLE") ||
      line.includes("ALTER TABLE") ||
      line.includes("schema")
    ) {
      context.schema_changes.push(line.trim());
    }
  }

  return context;
}

export function analyzeRepoActivity(
  repoPath: string
): {
  filesChanged: number;
  linesAdded: number;
  linesDeleted: number;
  topChangedFiles: string[];
} {
  const diffs = getDiffStat(repoPath);

  let linesAdded = 0;
  let linesDeleted = 0;
  const topFiles = diffs
    .sort((a, b) => b.additions + b.deletions - (a.additions + a.deletions))
    .slice(0, 5)
    .map(d => d.file);

  for (const diff of diffs) {
    linesAdded += diff.additions;
    linesDeleted += diff.deletions;
  }

  return {
    filesChanged: diffs.length,
    linesAdded,
    linesDeleted,
    topChangedFiles: topFiles
  };
}
