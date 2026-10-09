import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const PATTERNS = [
  { name: 'connection-string-credential', re: /:\/\/[^\s'"/]+:[^\s'"/@]+@[^\s'"/]+/g },
  { name: 'generic-password-assignment', re: /\b(password|passwd|pwd)\s*[:=]\s*['"][^'"\s]{4,}['"]/gi },
  { name: 'generic-api-key-assignment', re: /\b(api[_-]?key|secret|token)\s*[:=]\s*['"][^'"\s]{8,}['"]/gi },
  { name: 'aws-access-key-id', re: /\bAKIA[0-9A-Z]{16}\b/g },
  { name: 'private-key-block', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g },
];

export const ALLOWLIST = [
  // Disposable local/CI-only Postgres service credential used by the Wave D
  // CI workflow (.github/workflows/toolforge-wave-d.yml) — not a real secret,
  // scoped to a localhost-only container that never leaves the CI runner.
  // (The connection-string-credential pattern above stops matching at the
  // first "/" after the host:port, so the captured text never includes the
  // trailing "/toolforge_local" database name — allowlist the truncated form.)
  /:\/\/toolforge:toolforge@localhost:5432$/,

  // Disposable local Sigil relay Postgres development service container
  /:\/\/sigil:sigil_password@(localhost|127\.0\.0\.1):55432$/,

  // Example placeholder in .env.example
  /:\/\/user:password@localhost:5432$/,

  // Unit-test fixture API key values — obvious placeholder strings that can
  // never be real credentials (too short, no provider prefix).
  // Files: CIC-GOVERNANCE/packages/cic-whichllm-integration-pack/tests/unit/openrouter-provider.test.js
  /apiKey:\s*['"](?:test-key|local-key|or-key)['"]/,

  // Docker Compose environment variable template interpolation
  /:\/\/\$\{POSTGRES_USER:-postgres\}:\$\{POSTGRES_PASSWORD:-postgres\}@postgres:5432$/,

  // Kubernetes secret template example
  /:\/\/postgres:postgres@toolforge-db:5432$/,
];

export function checkContent(content, filename = 'staged') {
  const hits = [];
  if (!content) return hits;
  for (const { name, re } of PATTERNS) {
    const matches = content.match(re) || [];
    for (const m of matches) {
      if (ALLOWLIST.some((a) => a.test(m))) continue;
      hits.push(`${filename}: ${name} -> ${m.slice(0, 60)}`);
    }
  }
  return hits;
}

function stagedFiles() {
  return execFileSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACM'], { encoding: 'utf8' })
    .split('\n')
    .filter(Boolean)
    .filter((f) => !/\.(png|jpg|jpeg|gif|ico|lock)$/i.test(f));
}

function stagedContent(file) {
  try {
    return execFileSync('git', ['show', `:${file}`], { encoding: 'utf8' });
  } catch {
    return '';
  }
}

export function runScan() {
  let hits = [];
  for (const file of stagedFiles()) {
    const content = stagedContent(file);
    if (!content) continue;
    hits.push(...checkContent(content, file));
  }

  if (hits.length) {
    console.error('\nsecret-scan: possible credential(s) in staged changes:\n');
    for (const h of hits) console.error('  ' + h);
    console.error('\nIf this is a false positive (fixture data, disposable local/CI-only credential),');
    console.error('rename the string so it does not look like a real secret, or add it to ALLOWLIST');
    console.error('in scripts/secret-scan.mjs with a comment explaining why.\n');
    process.exit(1);
  }
}

const isCLI = process.argv[1] && (path.resolve(process.argv[1]) === fileURLToPath(import.meta.url) || process.argv[1].endsWith('secret-scan.mjs'));
if (isCLI) {
  runScan();
}
