import { existsSync, mkdirSync, readFileSync } from "fs";

export function ensureDir(dirPath: string): void {
  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true });
  }
}

export function readJsonFile<T>(filePath: string): T | null {
  try {
    if (!existsSync(filePath)) return null;
    const content = readFileSync(filePath, "utf-8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}

export function normalizeWindowDates(
  mode: "daily" | "weekly"
): { start: Date; end: Date } {
  const end = new Date();
  end.setUTCHours(0, 0, 0, 0);

  const start = new Date(end);
  if (mode === "daily") {
    start.setUTCDate(start.getUTCDate() - 1);
  } else if (mode === "weekly") {
    start.setUTCDate(start.getUTCDate() - 7);
  }

  return { start, end };
}

export function getLastNDays(n: number): Date[] {
  const dates: Date[] = [];
  for (let i = 0; i < n; i++) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - i);
    d.setUTCHours(0, 0, 0, 0);
    dates.push(d);
  }
  return dates;
}

export function formatDateISO(d: Date): string {
  return d.toISOString().split("T")[0];
}

export function isFileInPaths(filePath: string, roots: string[]): boolean {
  const normalized = filePath.toLowerCase().replace(/\\/g, "/");
  for (const root of roots) {
    const normRoot = root.toLowerCase().replace(/\\/g, "/");
    if (normalized.startsWith(normRoot)) {
      return true;
    }
  }
  return false;
}

export function getRelativePath(filePath: string, baseDir: string): string {
  const norm = filePath.replace(/\\/g, "/").toLowerCase();
  const normBase = baseDir.replace(/\\/g, "/").toLowerCase();

  if (norm.startsWith(normBase)) {
    return filePath.slice(baseDir.length).replace(/^[\\/]+/, "");
  }
  return filePath;
}

export function deduplicateArray<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

export function groupBy<T, K extends string | number>(
  arr: T[],
  keyFn: (item: T) => K
): Record<K, T[]> {
  const result: Record<K, T[]> = {} as any;
  for (const item of arr) {
    const key = keyFn(item);
    if (!result[key]) {
      result[key] = [];
    }
    result[key].push(item);
  }
  return result;
}

export interface Registry {
  repos?: Array<{
    name: string;
    path: string;
    type?: string;
  }>;
}

export function loadRegistry(registryPath: string): Registry {
  const data = readJsonFile<Registry>(registryPath);
  if (!data || !data.repos) {
    return { repos: [] };
  }
  return data;
}
