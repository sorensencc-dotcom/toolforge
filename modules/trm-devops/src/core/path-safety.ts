import fs from "node:fs";
import path from "node:path";

export function resolveSafePath(input: string, label: string): string {
  if (input.includes("\0")) throw new Error(`${label} contains a null byte`);
  const resolved = path.resolve(input);
  let current = resolved;
  const missing: string[] = [];
  while (!fs.existsSync(current)) {
    const parent = path.dirname(current);
    if (parent === current) break;
    missing.unshift(path.basename(current));
    current = parent;
  }
  const canonical = fs.realpathSync.native(current);
  if (canonical !== current) throw new Error(`${label} contains a symlinked path component`);
  return path.join(canonical, ...missing);
}