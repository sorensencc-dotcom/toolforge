// skills/repo-docs-diagram-sync/src/workflow-recon.mjs
import fs from 'node:fs';
import path from 'node:path';

export const WORKFLOW_TYPES = {
  SCRIPT: 'script',
  API_ENDPOINT: 'api_endpoint',
  CI_PIPELINE: 'ci_pipeline',
  DAEMON_SERVICE: 'daemon_service',
};

const IGNORED_DIRS = new Set([
  'node_modules', '.git', 'archive', '.claude', '.gemini', '.trm',
  'trm-drive', '_kb-sync-staging', '.ijfw', 'weekly-report-wt', '.worktrees',
  'dist', 'coverage', '.tmp.driveupload', '.serena', '.harness'
]);

/**
 * Discovers workflows across package.json, scripts/, server files, and CI workflows.
 * @param {string} repoDir
 * @returns {Array<{ id: string, name: string, type: string, sourceFile: string, description: string, stages: string[] }>}
 */
export function discoverWorkflows(repoDir) {
  const workflows = [];

  // 1. Scan package.json scripts
  const pkgPath = path.join(repoDir, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      if (pkg.scripts) {
        for (const [scriptName, scriptCmd] of Object.entries(pkg.scripts)) {
          if (scriptName.startsWith('test') || scriptName === 'build') continue;
          workflows.push({
            id: `npm-${scriptName.replace(/[^a-zA-Z0-9_-]/g, '-')}`,
            name: `NPM Script: ${scriptName}`,
            type: WORKFLOW_TYPES.SCRIPT,
            sourceFile: 'package.json',
            description: `Executes command: ${scriptCmd}`,
            stages: extractStagesFromCommand(scriptCmd),
          });
        }
      }
    } catch {
      // ignore JSON errors
    }
  }

  // 2. Scan scripts/ directory
  const scriptsDir = path.join(repoDir, 'scripts');
  if (fs.existsSync(scriptsDir) && fs.statSync(scriptsDir).isDirectory()) {
    try {
      const entries = fs.readdirSync(scriptsDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isFile() || !/\.(mjs|js|ts|ps1|sh)$/i.test(entry.name)) continue;
        const filePath = path.join(scriptsDir, entry.name);
        const content = fs.readFileSync(filePath, 'utf8');
        const stages = extractStagesFromSource(content);
        workflows.push({
          id: `script-${path.basename(entry.name, path.extname(entry.name))}`,
          name: `Script Workflow: ${entry.name}`,
          type: WORKFLOW_TYPES.SCRIPT,
          sourceFile: path.join('scripts', entry.name),
          description: extractFirstComment(content) || `Standalone automation script in scripts/${entry.name}`,
          stages: stages.length > 0 ? stages : ['Initialize', 'Execute Script Logic', 'Complete & Report'],
        });
      }
    } catch {
      // ignore
    }
  }

  // 3. Scan CI GitHub workflows
  const workflowsDir = path.join(repoDir, '.github', 'workflows');
  if (fs.existsSync(workflowsDir) && fs.statSync(workflowsDir).isDirectory()) {
    try {
      const entries = fs.readdirSync(workflowsDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isFile() || !/\.(yml|yaml)$/i.test(entry.name)) continue;
        const filePath = path.join(workflowsDir, entry.name);
        const content = fs.readFileSync(filePath, 'utf8');
        const nameMatch = content.match(/^name:\s*["']?(.+?)["']?\s*$/m);
        const workflowName = nameMatch ? nameMatch[1] : entry.name;
        const jobs = extractGithubWorkflowJobs(content);
        workflows.push({
          id: `ci-${path.basename(entry.name, path.extname(entry.name))}`,
          name: `CI Workflow: ${workflowName}`,
          type: WORKFLOW_TYPES.CI_PIPELINE,
          sourceFile: path.join('.github', 'workflows', entry.name),
          description: `GitHub Actions CI workflow defined in ${entry.name}`,
          stages: jobs.length > 0 ? jobs : ['Checkout', 'Setup Environment', 'Run Verification', 'Deploy / Complete'],
        });
      }
    } catch {
      // ignore
    }
  }

  // 4. Scan server routes / endpoints
  const serverPath = path.join(repoDir, 'src', 'server.mjs');
  if (fs.existsSync(serverPath)) {
    try {
      const content = fs.readFileSync(serverPath, 'utf8');
      const endpoints = extractEndpointsFromCode(content);
      for (const ep of endpoints) {
        workflows.push({
          id: `api-${ep.method.toLowerCase()}-${ep.path.replace(/[^a-zA-Z0-9_-]/g, '-')}`,
          name: `API Route: ${ep.method} ${ep.path}`,
          type: WORKFLOW_TYPES.API_ENDPOINT,
          sourceFile: path.join('src', 'server.mjs'),
          description: `HTTP ${ep.method} endpoint on ${ep.path}`,
          stages: ['HTTP Request Ingress', 'Auth & Payload Validation', 'Business Logic Execution', 'State Mutation / Query', 'HTTP Response Egress'],
        });
      }
    } catch {
      // ignore
    }
  }

  return workflows;
}

/**
 * Correlates discovered workflows with existing documentation to detect undocumented or updated workflows.
 * @param {string} repoDir
 * @param {Array<object>} workflows
 * @returns {Array<object & { isDocumented: boolean, docFile?: string, needsUpdate: boolean }>}
 */
export function auditWorkflowDocumentation(repoDir, workflows) {
  const docFiles = findMarkdownDocuments(repoDir);
  const docContents = docFiles.map((f) => ({
    path: f,
    content: fs.readFileSync(f, 'utf8').toLowerCase(),
    mtime: fs.statSync(f).mtimeMs,
  }));

  return workflows.map((wf) => {
    const searchTerms = [
      wf.id.toLowerCase(),
      wf.name.toLowerCase(),
      wf.sourceFile.toLowerCase(),
    ];

    let foundDoc = null;
    for (const doc of docContents) {
      if (searchTerms.some((term) => doc.content.includes(term))) {
        foundDoc = doc;
        break;
      }
    }

    if (!foundDoc) {
      return { ...wf, isDocumented: false, docFile: null, needsUpdate: true };
    }

    // If source file is newer than the doc file, it needs update
    const sourceAbs = path.join(repoDir, wf.sourceFile);
    let isNewer = false;
    if (fs.existsSync(sourceAbs)) {
      isNewer = fs.statSync(sourceAbs).mtimeMs > foundDoc.mtime;
    }

    return {
      ...wf,
      isDocumented: true,
      docFile: path.relative(repoDir, foundDoc.path),
      needsUpdate: isNewer,
    };
  });
}

function findMarkdownDocuments(dir) {
  const docs = [];
  const walk = (d) => {
    try {
      const entries = fs.readdirSync(d, { withFileTypes: true });
      for (const entry of entries) {
        if (IGNORED_DIRS.has(entry.name)) continue;
        const full = path.join(d, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (entry.isFile() && entry.name.endsWith('.md')) docs.push(full);
      }
    } catch {
      // ignore
    }
  };
  walk(dir);
  return docs;
}

function extractStagesFromCommand(cmd) {
  const parts = cmd.split(/&&|\|\||;/).map((p) => p.trim()).filter(Boolean);
  if (parts.length > 1) {
    return parts.map((p, idx) => `Stage ${idx + 1}: ${p.replace(/^node\s+|^npm\s+run\s+/i, '')}`);
  }
  return ['Trigger Command', 'Execute Process', 'Inspect Exit Code'];
}

function extractStagesFromSource(code) {
  const stages = [];
  const matches = code.matchAll(/(?:\/\/\s*Stage\s*\d*:\s*|\/\/\s*Step\s*\d*:\s*|console\.log\(['"`](?:\[\d+\/\d+\]|===)\s*)([^'"`\n\r]+)/gi);
  for (const m of matches) {
    const clean = m[1].replace(/===+/g, '').trim();
    if (clean && !stages.includes(clean)) stages.push(clean);
  }
  return stages;
}

function extractGithubWorkflowJobs(content) {
  const jobs = [];
  const lines = content.split('\n');
  let inJobs = false;
  for (const line of lines) {
    if (/^jobs:\s*$/i.test(line)) {
      inJobs = true;
      continue;
    }
    if (inJobs) {
      const match = line.match(/^  ([a-zA-Z0-9_-]+):\s*$/);
      if (match) jobs.push(`Job: ${match[1]}`);
      else if (/^[a-zA-Z0-9_-]+:\s*$/.test(line)) {
        break; // Exited jobs block
      }
    }
  }
  return jobs;
}

function extractEndpointsFromCode(code) {
  const endpoints = [];
  // Match: req.url === '/api/something' or case '/api/something': or if (url.pathname === '/api/...')
  const regex = /(?:req\.url\s*===\s*|url\.pathname\s*===\s*|case\s*)['"](\/api\/[a-zA-Z0-9/_-]+)['"]/g;
  let match;
  while ((match = regex.exec(code)) !== null) {
    const route = match[1];
    if (!endpoints.some((e) => e.path === route)) {
      endpoints.push({ method: 'POST/GET', path: route });
    }
  }
  return endpoints.slice(0, 10); // Cap top 10 endpoints
}

function extractFirstComment(code) {
  const match = code.match(/^\/\/\s*(.+?)$/m);
  return match ? match[1].trim() : null;
}
