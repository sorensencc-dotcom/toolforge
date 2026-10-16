// Phase 2 measurement: schema tokens per real MCP tool catalog in this repo.
// Servers are not booted. Each tool array is sliced from source and evaluated in a VM, because the
// modules import @modelcontextprotocol/sdk (not installed at the repo root) or do not export the array.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { heuristicTokenCounter } from './scoping-hook.mjs';

// Override with MCP_CATALOG_ROOT to measure another checkout (some catalogs exist only on unmerged branches).
const root = process.env.MCP_CATALOG_ROOT ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

/** Evaluate a source slice that is a plain JS array literal, with the given constants in scope. */
function evalArray(code, scope = {}) {
  return vm.runInNewContext(`(${code})`, scope, { timeout: 1000 });
}

/** Slice from the first `[` at or after `from` to its matching `]`, skipping strings. */
function sliceArray(src, from) {
  const start = src.indexOf('[', from);
  let depth = 0;
  let quote = null;
  for (let i = start; i < src.length; i++) {
    const c = src[i];
    if (quote) {
      if (c === '\\') i++;
      else if (c === quote) quote = null;
    } else if (c === '"' || c === "'" || c === '`') quote = c;
    else if (c === '[') depth++;
    else if (c === ']' && --depth === 0) return src.slice(start, i + 1);
  }
  throw new Error('unbalanced array');
}

function vikingTools() {
  const src = read('modules/mcp/viking-vfs-server.mjs');
  return evalArray(sliceArray(src, src.indexOf('const VIKING_TOOLS =')));
}

function researchStoreTools() {
  const src = read('skills/research-store/src/mcp-server.mjs');
  const store = read('skills/research-store/src/store.mjs');
  const list = (name) => evalArray(sliceArray(store, store.indexOf(`export const ${name}`)));
  const scope = { project: { type: 'string', enum: list('PROJECTS') }, status: { type: 'string', enum: list('STATUSES') } };
  // The array may reference other module-level consts; evaluation fails loudly if so.
  return evalArray(sliceArray(src, src.indexOf('const tools =')), scope);
}

function trmDevopsTools() {
  const src = read('modules/trm-devops/src/mcp/server.ts');
  return evalArray(sliceArray(src, src.indexOf('return [', src.indexOf('export function getMcpTools'))));
}

const toWire = (t) => ({ name: t.name, description: t.description ?? '', input_schema: t.inputSchema ?? t.input_schema ?? {} });

const sources = {
  'viking-vfs (modules/mcp)': vikingTools,
  'research-store (skills)': researchStoreTools,
  'trm-devops (modules)': trmDevopsTools,
};
const catalogs = {};
const skipped = [];
for (const [name, load] of Object.entries(sources)) {
  try {
    catalogs[name] = load();
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
    skipped.push(name);
  }
}

const rows = [];
let totalTools = 0;
let totalTokens = 0;
for (const [name, tools] of Object.entries(catalogs)) {
  const per = tools.map((t) => ({ name: t.name, tokens: heuristicTokenCounter.count(toWire(t)) }));
  const tokens = per.reduce((n, p) => n + p.tokens, 0);
  rows.push({ catalog: name, tools: tools.length, tokens, perTool: Math.round(tokens / Math.max(1, tools.length)), largest: per.sort((a, b) => b.tokens - a.tokens)[0] });
  totalTools += tools.length;
  totalTokens += tokens;
}
console.log(JSON.stringify({ rows, totalTools, totalTokens, perTool: Math.round(totalTokens / totalTools), skipped, root, counter: 'heuristic chars/3.8 of {name, description, input_schema}' }, null, 2));
