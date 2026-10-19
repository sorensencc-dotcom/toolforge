import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

export const DEFAULT_REPO_ROOTS = [
  'C:\\dev',
  'C:\\dev\\kb-sync',
  'C:\\dev\\sigil-repo',
  'C:\\dev\\rewrite-mcp',
  'C:\\dev\\icf'
];

export const DEFAULT_MCP_DIR = 'C:\\Users\\soren\\.gemini\\antigravity\\mcp';
export const DEFAULT_REGISTRY_PATH = 'C:\\dev\\notebooklm-registry.json';
export const DEFAULT_GUIDE_OUTPUT_PATH = 'C:\\dev\\docs\\Ecosystem Architecture Guide (Current).md';
export const DRIVE_MASTER_URL = 'https://docs.google.com/document/d/1zTiYlA6NIhJRDsr0_9s0I_oQKUnW6l8eJX6xqYGRM_M/edit?usp=drivesdk&ouid=108918430137219217175';

export function extractRepoTopology(repoRoots = DEFAULT_REPO_ROOTS) {
  const repos = [];
  for (const root of repoRoots) {
    if (!fs.existsSync(root)) {
      continue;
    }

    try {
      const isWorkTree = execSync('git rev-parse --is-inside-work-tree', {
        cwd: root,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe']
      }).trim();

      if (isWorkTree !== 'true') {
        continue;
      }

      let branch = '';
      try {
        branch = execSync('git branch --show-current', {
          cwd: root,
          encoding: 'utf8',
          stdio: ['pipe', 'pipe', 'pipe']
        }).trim();
      } catch {
        // fallback
      }

      if (!branch) {
        try {
          branch = execSync('git rev-parse --abbrev-ref HEAD', {
            cwd: root,
            encoding: 'utf8',
            stdio: ['pipe', 'pipe', 'pipe']
          }).trim();
        } catch {
          branch = 'HEAD';
        }
      }

      const logOutput = execSync('git log -n 1 --format="%h|%s|%ci"', {
        cwd: root,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe']
      }).trim();

      const [lastCommitHash = '', lastCommitMessage = '', lastCommitDate = ''] = logOutput.split('|');

      repos.push({
        name: path.basename(root),
        path: root,
        branch,
        lastCommitHash,
        lastCommitMessage,
        lastCommitDate,
        active: true
      });
    } catch {
      continue;
    }
  }

  return repos;
}

export function extractMcpTopology(mcpDir = DEFAULT_MCP_DIR) {
  if (!fs.existsSync(mcpDir)) {
    return [];
  }

  let entries = [];
  try {
    entries = fs.readdirSync(mcpDir, { withFileTypes: true });
  } catch {
    return [];
  }

  const servers = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const serverDir = path.join(mcpDir, entry.name);
    let files = [];
    try {
      files = fs.readdirSync(serverDir).filter(f => f.endsWith('.json'));
    } catch {
      files = [];
    }

    const tools = [];
    for (const f of files) {
      try {
        const parsed = JSON.parse(fs.readFileSync(path.join(serverDir, f), 'utf8'));
        tools.push(parsed.name || path.basename(f, '.json'));
      } catch {
        tools.push(path.basename(f, '.json'));
      }
    }

    servers.push({
      name: entry.name,
      toolCount: tools.length,
      tools
    });
  }

  servers.sort((a, b) => a.name.localeCompare(b.name));
  return servers;
}

export function extractNotebookDirectory(registryPath = DEFAULT_REGISTRY_PATH) {
  const emptyResult = {
    totalCount: 0,
    categories: {
      'Operational': [],
      'Core Software Architecture': [],
      'Historical CIC': [],
      'Personal OS': []
    },
    notebooks: []
  };

  if (!fs.existsSync(registryPath)) {
    return emptyResult;
  }

  let reg;
  try {
    reg = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
  } catch {
    return emptyResult;
  }

  const rawNotebooks = Array.isArray(reg.notebooks) ? reg.notebooks : [];
  const categorized = {
    'Operational': [],
    'Core Software Architecture': [],
    'Historical CIC': [],
    'Personal OS': []
  };

  const notebooks = [];

  for (const nb of rawNotebooks) {
    const id = nb.notebook_id || '';
    const title = nb.title || '';
    let category = 'Operational';

    if (/Personal OS/i.test(title) || id === '9724e682-c5ea-4693-8e21-caf8de68611e') {
      category = 'Personal OS';
    } else if (
      /IronLedger|Sigil|Agent Harness|Rewrite Labs|Open Dev Issues/i.test(title) ||
      ['76e1932c-054a-4520-9e83-5e882dffc938', '26eacb85-2c97-443d-9d81-3bd99cc98412', '359b346c-6af7-4ba3-baef-b985c9e6e1af', '140119ae-3496-45c9-bf0c-71c955136afc', 'cb0498ce-1ea5-4668-9f65-ac368753404e'].includes(id)
    ) {
      category = 'Core Software Architecture';
    } else if (/(?:^CIC\b|^Cast\s*Iron\s*Charlie|^Willow Run|^The Sorensen|Cuban Seizures|Willys-Overland|Ford Executive|Miami Estate|Rouge)/i.test(title)) {
      category = 'Historical CIC';
    }

    const item = { id, title, category };
    categorized[category].push(item);
    notebooks.push(item);
  }

  return {
    totalCount: notebooks.length,
    categories: categorized,
    notebooks
  };
}

export function compileEcosystemGuide({ repos = [], mcps = [], notebooks = {}, timestamp = new Date() }) {
  const isoTimestamp = timestamp instanceof Date ? timestamp.toISOString() : String(timestamp);

  let notebookList = [];
  if (Array.isArray(notebooks)) {
    notebookList = notebooks;
  } else if (notebooks && Array.isArray(notebooks.notebooks)) {
    notebookList = notebooks.notebooks;
  } else if (notebooks && notebooks.categories) {
    for (const [category, items] of Object.entries(notebooks.categories)) {
      if (Array.isArray(items)) {
        for (const item of items) {
          notebookList.push({ ...item, category: item.category || category });
        }
      }
    }
  }

  const repoRows = repos.length === 0
    ? '| _None detected_ | - | - | - |\n'
    : repos.map(r => `| **${r.name}** | \`${r.branch}\` | \`${r.lastCommitHash}\` ${(r.lastCommitMessage || '').replace(/\|/g, '\\|')} | ${r.lastCommitDate} |`).join('\n') + '\n';

  const mcpRows = mcps.length === 0
    ? '| _None detected_ | 0 | - |\n'
    : mcps.map(m => {
        const keyTools = (m.tools || []).slice(0, 4).join(', ') + ((m.tools || []).length > 4 ? ', ...' : '');
        return `| **${m.name}** | ${m.toolCount} | ${keyTools || '-'} |`;
      }).join('\n') + '\n';

  const notebookRows = notebookList.length === 0
    ? '| _None registered_ | - | - |\n'
    : notebookList.map(n => `| ${n.category || 'General'} | \`${n.id}\` | ${n.title} |`).join('\n') + '\n';

  return `# Ecosystem Architecture Guide (Current)

> **Document Status:** Authoritative Architectural Standard  
> **Last Synchronized:** ${isoTimestamp}  
> **Drive Master:** [Ecosystem Architecture Guide (Current).md](${DRIVE_MASTER_URL})  
> **Target Alignment:** CIC Historical, Core Software Architecture, Personal OS & Organization Repositories

---

## 1. Core Repositories & Engine Status (Knowledge Plane Partitioning)

The knowledge plane is strictly partitioned into three independent domains to eliminate cross-domain concept pollution (e.g., preventing software architecture topics from spilling into historical research packs or daily buffer notebooks):

\`\`\`
+-----------------------------------------------------------------------------------+
|                              PARTITIONED KNOWLEDGE PLANE                           |
+------------------------------------+----------------------------------------------+
| 1. Historical Workstreams (CIC)    | 2. Core Software Architecture & Dev          |
|    - Willow Run & Aviation         |    - IronLedger Architecture                 |
|    - Ford Executive Dynamics       |    - Sigil Protocol & Federation             |
|    - Post-War                      |    - Agent Harness Registry                  |
|    - Willys-Overland               |                                              |
|    - Cuban Seizures                |    - Rewrite Labs SSG Platform               |
|    - Miami Estate & Retirement     |    - Open Dev Triage Buffer                  |
|    - Rouge & Moving Assembly Line  +----------------------------------------------+
|    - CIC-KB (Master Historical)    | 3. Personal OS & Operations                  |
|    - Daily Research Buffer         |    - Household, Utilities, Florida Logistics |
+------------------------------------+----------------------------------------------+
\`\`\`

---

## 2. Active Repository Commit Topology

| Repository | Branch | Latest Commit | Date |
|---|---|---|---|
${repoRows}
---

## 3. Active MCP Tooling & Server Topology

| MCP Server | Tool Count | Key Tools |
|---|---|---|
${mcpRows}
---

## 4. Local Service Ports & Active System Topology

| Service / Subsystem | Local Port(s) | Topology Role & Endpoint Details |
|---|---|---|
| **ICF (Iron Core Fabric)** | \`3000\` | Local dashboard, orchestrator, and telemetry frontend |
| **IronLedger Workbench** | \`5000 / 5050\` | Double-entry core accounting API and administration workbench |
| **Sigil Loopback Relay** | \`8765\` | Cryptographic identity relay and federated protocol broker |
| **Ollama Inference Engine** | \`11434\` | Local model inference provider and embeddings service |

---

## 5. Target Notebook Cluster Directory

| Category | Notebook ID | Title |
|---|---|---|
${notebookRows}`;
}

export function generateAndWriteGuide(outputPath = DEFAULT_GUIDE_OUTPUT_PATH, options = {}) {
  const repos = extractRepoTopology(options.repoRoots);
  const mcps = extractMcpTopology(options.mcpDir);
  const notebooks = extractNotebookDirectory(options.registryPath);
  const content = compileEcosystemGuide({ repos, mcps, notebooks, timestamp: options.timestamp });

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  const tempPath = `${outputPath}.tmp.${process.pid}.${Date.now()}`;
  fs.writeFileSync(tempPath, content, 'utf8');
  fs.copyFileSync(tempPath, outputPath);
  try {
    fs.unlinkSync(tempPath);
  } catch {
    // cleanup
  }

  return {
    outputPath,
    repoCount: repos.length,
    mcpCount: mcps.length,
    notebookCount: notebooks.totalCount !== undefined ? notebooks.totalCount : (Array.isArray(notebooks) ? notebooks.length : 0),
    bytesWritten: Buffer.byteLength(content, 'utf8'),
    timestamp: options.timestamp || new Date()
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  try {
    const summary = generateAndWriteGuide();
    console.log(`[OK] Generated guide at: ${summary.outputPath}`);
    console.log(`     Bytes: ${summary.bytesWritten}, Repos: ${summary.repoCount}, MCPs: ${summary.mcpCount}, Notebooks: ${summary.notebookCount}`);
  } catch (err) {
    console.error(`[ERROR] Failed to generate guide:`, err.message);
    process.exit(1);
  }
}
