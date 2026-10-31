import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
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

export const DEFAULT_CONTRACT_HUBS = [
  {
    subsystem: 'sigil-repo',
    repo: 'C:\\dev\\sigil-repo',
    file: 'sigil/relay/v1/room-routes.mjs',
    role: 'Room message dispatch & SSE stream session lifecycle'
  },
  {
    subsystem: 'sigil-repo',
    repo: 'C:\\dev\\sigil-repo',
    file: 'sigil/relay/v1/accept-envelope.mjs',
    role: 'Federation envelope cryptographic verification & resend handling'
  },
  {
    subsystem: 'icf',
    repo: 'C:\\dev\\icf',
    file: 'src/server.mjs',
    role: 'Port 8080/3000 telemetry hub & action dispatcher'
  },
  {
    subsystem: 'kb-sync',
    repo: 'C:\\dev\\kb-sync',
    file: 'watch-competitors-v2.mjs',
    role: 'Competitor watchlist monitor & diff engine'
  },
  {
    subsystem: 'marketplace',
    repo: 'C:\\dev',
    file: 'src/api/server.js',
    role: 'Registry API endpoints & install telemetry'
  }
];

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

export function extractTrailSkeletons(hubs = DEFAULT_CONTRACT_HUBS) {
  const results = [];
  for (const hub of hubs) {
    if (!fs.existsSync(hub.repo)) {
      continue;
    }
    const fullPath = path.resolve(hub.repo, hub.file);
    if (!fs.existsSync(fullPath)) {
      continue;
    }

    let signatures = [];
    try {
      const stdout = execSync(`trail skeleton --no-refresh "${hub.file}" "${hub.repo}"`, {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe']
      });

      signatures = stdout
        .split('\n')
        .map(l => l.trim())
        .filter(l => l && !l.startsWith('[trail]') && !l.startsWith('trail skeleton'))
        .filter(l => !l.includes('no definitions indexed for this file'));

      if (signatures.length === 0) {
        signatures = ['// No symbol definitions extracted from AST'];
      }
    } catch (err) {
      signatures = [`// Extraction fallback: ${err.message}`];
    }

    results.push({
      subsystem: hub.subsystem,
      file: hub.file,
      repo: hub.repo,
      role: hub.role,
      signatures
    });
  }
  return results;
}

export async function synthesizeWithGemini({ repos = [], skeletons = [], apiKey = null, timeoutMs = 8000 } = {}) {
  const key = apiKey || process.env.GEMINI_API_KEY;
  if (!key) {
    return null;
  }

  const repoSummary = repos.map(r => `- ${r.name} (${r.branch}): \`${r.lastCommitHash}\` ${r.lastCommitMessage}`).join('\n');
  const skeletonSummary = skeletons.map(s => `### ${s.subsystem} (${s.file}) - ${s.role}\n${s.signatures.slice(0, 6).join('\n')}`).join('\n\n');

  const prompt = `You are the chief systems architect for the CIC Rewrite Labs ecosystem.
Given the latest repository commit topology and current Trail AST contract skeletons below, generate an authoritative daily architectural advisory (maximum 3 concise markdown paragraphs):
1. **Architectural Delta & Invariants**: Highlight active interface changes or confirmed stability in core contracts.
2. **Cross-Subsystem Protocol & Routing**: Address how Sigil, ICF, IronLedger, and NotebookLM clusters bind together today.
3. **Agent & CLI Advisory**: Concrete guidance and watch-outs for Claude Code, Grok Bot, and NotebookLM queries.

Active Repos:
${repoSummary}

Trail AST Contract Skeletons:
${skeletonSummary}
`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 800 }
      }),
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    return text ? text.trim() : null;
  } catch {
    return null;
  }
}

export function compileEcosystemGuide({ repos = [], mcps = [], notebooks = {}, skeletons = [], geminiSynthesis = null, timestamp = new Date() }) {
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

  const skeletonSections = skeletons.length === 0
    ? '_No contract hubs extracted._\n'
    : skeletons.map(s => `### Subsystem: \`${s.subsystem}\`
> **File:** \`${s.file}\`  
> **Role:** ${s.role}  
> **Repo Root:** \`${s.repo}\`

\`\`\`javascript
${s.signatures.join('\n')}
\`\`\`
`).join('\n');

  const geminiBlock = geminiSynthesis
    ? `---

## Daily Architectural Delta & Agent Advisory (Gemini Synthesized)

> **Synthesis Engine:** Gemini 2.5 Flash | **Status:** Live Daily Delta  

${geminiSynthesis}

`
    : '';

  return `# Ecosystem Architecture Guide (Current)

> **Document Status:** Authoritative Architectural Standard  
> **Last Synchronized:** ${isoTimestamp}  
> **Drive Master:** [Ecosystem Architecture Guide (Current).md](${DRIVE_MASTER_URL})  
> **Target Alignment:** CIC Historical, Core Software Architecture, Personal OS & Organization Repositories

${geminiBlock}---

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
| **ICF (Iron Core Fabric)** | \`3000 / 8080\` | Local dashboard, orchestrator, and telemetry frontend |
| **IronLedger Workbench** | \`5000 / 5050\` | Double-entry core accounting API and administration workbench |
| **Sigil Loopback Relay** | \`8765\` | Cryptographic identity relay and federated protocol broker |
| **Ollama Inference Engine** | \`11434\` | Local model inference provider and embeddings service |

---

## 5. Target Notebook Cluster Directory

| Category | Notebook ID | Title |
|---|---|---|
${notebookRows}
---

## 6. Cross-Subsystem Architectural & Sequence Flow Diagrams

### A. Subsystem Topology & Port Architecture
\`\`\`mermaid
flowchart TD
    subgraph Agents["Autonomous Agent Runtime & CLIs"]
        AG["Antigravity / Gemini 3.8"]
        CC["Claude Code"]
        GB["Grok Bot"]
        NLMC["NotebookLM CLI (nlm)"]
    end

    subgraph CoreServices["Local Service Invariants & Ports"]
        Sigil["Sigil Loopback Relay\\n(sigil-repo :8765)"]
        ICF["ICF Hub & Dispatcher\\n(icf/src/server.mjs :3000 / :8080)"]
        IL["IronLedger API\\n(journal.py :5000 / :5050)"]
        Ollama["Ollama Inference Engine\\n(:11434)"]
    end

    subgraph Storage["Knowledge Plane & Storage Hubs"]
        CIC["1. CIC Historical Workstreams\\n(CIC-KB, Sorensen Archive)"]
        DEV["2. Core Software Architecture\\n(IronLedger, Sigil, Rewrite Labs)"]
        POS["3. Personal OS & Operations\\n(Household, Utilities, Florida)"]
    end

    AG -->|Signed Envelopes| Sigil
    CC -->|Signed Envelopes| Sigil
    GB -->|Signed Envelopes| Sigil
    Sigil -->|Room Events| ICF
    ICF -->|Dispatch Actions| IL
    ICF -->|Ingest & Resync| NLMC
    NLMC -->|Direct Sync| CIC
    NLMC -->|Direct Sync| DEV
    NLMC -->|Direct Sync| POS
\`\`\`

### B. Agent Task Routing & Federation Protocol
\`\`\`mermaid
sequenceDiagram
    autonumber
    participant Agent as Agent / CLI Client
    participant Sigil as Sigil Relay (:8765)
    participant ICF as ICF Dispatcher (:8080)
    participant NLM as NotebookLM Clusters (31 Notebooks)

    Agent->>Sigil: POST /rooms/:id/messages (Ed25519 Signed Envelope)
    Sigil->>Sigil: accept-envelope.mjs (Verify Signature & Sequence)
    Sigil->>ICF: notifyRoomChange(roomId, changed)
    ICF->>ICF: refreshPullRequestsAsync() & Action Dispatcher
    ICF->>NLM: nlm source sync / nlm source add
    NLM-->>Agent: Authoritative Grounded Context & Citations
\`\`\`

### C. Knowledge Plane Domain Isolation
\`\`\`mermaid
flowchart LR
    subgraph P1["Plane 1: Historical Workstreams (CIC)"]
        direction TB
        CIC1["Willow Run & Aviation"]
        CIC2["Ford Executive Dynamics"]
        CIC3["CIC-KB Master"]
    end

    subgraph P2["Plane 2: Core Software Architecture"]
        direction TB
        DEV1["IronLedger Architecture"]
        DEV2["Sigil Protocol & Federation"]
        DEV3["Rewrite Labs SSG Platform"]
        DEV4["Open Dev Triage Buffer"]
    end

    subgraph P3["Plane 3: Personal OS & Operations"]
        direction TB
        POS1["Household & Utilities"]
        POS2["Florida Logistics"]
    end

    P1 -.->|STRICT BARRIER: No Cross-Domain Leakage| P2
    P2 -.->|STRICT BARRIER: No Cross-Domain Leakage| P3
\`\`\`

---

## 7. High-Gravity Architectural Contract Hubs (Trail AST Skeletons)

${skeletonSections}
---

## 8. Authoritative Agent & CLI Invariant Rules (Source of Truth)

1. **Deterministic Search Policy**:
   - Before performing workspace-wide text searches (\`grep\`, \`rg\`, \`findstr\`), consult the deterministic codebase indexes: run \`trail skeleton <file>\` or \`trail callers <symbol>\`.
   - Raw file greps across entire repositories are blocked by governance policy.
2. **Local Port & Dashboard Surface Allocation**:
   - \`3000 / 8080\`: ICF Dashboard & Action Server. Strictly modify \`icf/dashboard/index.html\`. Never copy root legacy \`dashboard.html\`.
   - \`5000 / 5050\`: IronLedger core accounting API and administration workbench.
   - \`8765\`: Sigil loopback cryptographic identity relay.
   - \`11434\`: Local Ollama inference engine.
3. **Knowledge Plane Partitioning Protocol**:
   - Never cross-pollinate concepts across Historical CIC, Core Software Architecture, and Personal OS.
   - Historical research queries must bind strictly to the 15 Historical CIC notebooks (\`CIC-KB\`, etc.).
   - Software development tasks must bind strictly to Core Software Architecture notebooks.
4. **NotebookLM CLI Synchronization Commands**:
   - Synchronize master Drive source in place: \`nlm source sync "<notebook-id>" --confirm\`
   - Upload new architectural guide version: \`nlm source add "<notebook-id>" --file "C:\\dev\\docs\\Ecosystem Architecture Guide (Current).md"\`
`;
}

function writeGuideFile(outputPath, { repos, mcps, notebooks, skeletons, geminiSynthesis, timestamp }) {
  const content = compileEcosystemGuide({
    repos,
    mcps,
    notebooks,
    skeletons,
    geminiSynthesis,
    timestamp
  });

  try {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  } catch {
    // directory already exists or permission restricted
  }

  let finalPath = outputPath;
  const tempPath = path.join(os.tmpdir(), `${path.basename(outputPath)}.tmp.${process.pid}.${Date.now()}`);

  try {
    fs.writeFileSync(tempPath, content, 'utf8');
    try {
      fs.copyFileSync(tempPath, outputPath);
      fs.unlinkSync(tempPath);
    } catch (copyErr) {
      if (copyErr.code === 'EPERM' || copyErr.code === 'EACCES') {
        // Fall back to writing directly or using temp location in restricted sandbox
        try {
          fs.writeFileSync(outputPath, content, 'utf8');
        } catch {
          finalPath = tempPath;
        }
      } else {
        throw copyErr;
      }
    }
  } catch (err) {
    if (err.code === 'EPERM' || err.code === 'EACCES') {
      finalPath = path.join(os.tmpdir(), path.basename(outputPath));
      fs.writeFileSync(finalPath, content, 'utf8');
    } else {
      throw err;
    }
  }

  return {
    outputPath: finalPath,
    repoCount: repos.length,
    mcpCount: mcps.length,
    notebookCount: notebooks.totalCount !== undefined ? notebooks.totalCount : (Array.isArray(notebooks) ? notebooks.length : 0),
    skeletonCount: skeletons.length,
    hasGeminiSynthesis: !!geminiSynthesis,
    bytesWritten: Buffer.byteLength(content, 'utf8'),
    timestamp: timestamp || new Date()
  };
}

export function generateAndWriteGuide(outputPath = DEFAULT_GUIDE_OUTPUT_PATH, options = {}) {
  const repos = extractRepoTopology(options.repoRoots);
  const mcps = extractMcpTopology(options.mcpDir);
  const notebooks = extractNotebookDirectory(options.registryPath);
  const skeletons = extractTrailSkeletons(options.contractHubs);

  if (options.withGemini && process.env.GEMINI_API_KEY) {
    return (async () => {
      const geminiSynthesis = await synthesizeWithGemini({ repos, skeletons, apiKey: options.geminiApiKey });
      return writeGuideFile(outputPath, { repos, mcps, notebooks, skeletons, geminiSynthesis, timestamp: options.timestamp });
    })();
  }

  return writeGuideFile(outputPath, {
    repos,
    mcps,
    notebooks,
    skeletons,
    geminiSynthesis: options.geminiSynthesis || null,
    timestamp: options.timestamp
  });
}

export async function generateAndWriteGuideAsync(outputPath = DEFAULT_GUIDE_OUTPUT_PATH, options = {}) {
  const repos = extractRepoTopology(options.repoRoots);
  const mcps = extractMcpTopology(options.mcpDir);
  const notebooks = extractNotebookDirectory(options.registryPath);
  const skeletons = extractTrailSkeletons(options.contractHubs);

  let geminiSynthesis = options.geminiSynthesis || null;
  if (!options.noGemini && (options.withGemini || process.env.GEMINI_API_KEY)) {
    geminiSynthesis = await synthesizeWithGemini({ repos, skeletons, apiKey: options.geminiApiKey });
  }

  return writeGuideFile(outputPath, {
    repos,
    mcps,
    notebooks,
    skeletons,
    geminiSynthesis,
    timestamp: options.timestamp
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  (async () => {
    try {
      const args = process.argv.slice(2);
      const withGemini = args.includes('--with-gemini');
      const summary = await generateAndWriteGuideAsync(DEFAULT_GUIDE_OUTPUT_PATH, { withGemini });
      console.log(`[OK] Generated guide at: ${summary.outputPath}`);
      console.log(`     Bytes: ${summary.bytesWritten}, Repos: ${summary.repoCount}, MCPs: ${summary.mcpCount}, Notebooks: ${summary.notebookCount}, Skeletons: ${summary.skeletonCount}, Gemini: ${summary.hasGeminiSynthesis}`);
    } catch (err) {
      console.error(`[ERROR] Failed to generate guide:`, err.message);
      process.exit(1);
    }
  })();
}
