import { access, open, readFile, realpath, stat } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import reviewed from './invocation-reviewed.json' with { type: 'json' };

export const CONTRACT_VERSION = 1;
export const MAX_INPUT_BYTES = 64 * 1024;
export const MAX_FILE_BYTES = 1024 * 1024;
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const strings = value => Array.isArray(value) && value.every(v => typeof v === 'string');
const integer = value => Number.isSafeInteger(value) && value >= 0;
const timestamp = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(Date.parse(value));
function error(code, message, fieldErrors) {
  return Object.assign(new Error(message), { code, ...(fieldErrors ? { fieldErrors } : {}) });
}
function invalid(field, message) { throw error('INVALID_INPUT', 'Invalid invocation input', { [field]: message }); }
function keys(value, required, optional = []) {
  return object(value) && required.every(k => Object.hasOwn(value, k)) && Object.keys(value).every(k => required.includes(k) || optional.includes(k));
}
function fields(definitions) { return Object.freeze(definitions.map(field => Object.freeze(field))); }
const descriptors = Object.freeze({
  'roadmap-validator': Object.freeze({ contractVersion: 1, id: 'roadmap-validator', entrypoint: 'skills/roadmap-validator/src/index.ts', exportName: 'default', argument: 'input', readOnly: true, runtime: 'typescript', validate: validateRoadmapInput, fields: fields([
    { name: 'roadmapPath', type: 'path', required: true, extension: '.md', maxBytes: MAX_FILE_BYTES },
    { name: 'strict', type: 'boolean', required: false, default: false },
    { name: 'verbose', type: 'boolean', required: false, default: false },
  ]) }),
  'agent-drift-detector': Object.freeze({ contractVersion: 1, id: 'agent-drift-detector', entrypoint: 'skills/agent-drift-detector/src/index.ts', exportName: 'detectDrift', argument: 'input', readOnly: true, runtime: 'typescript', validate: validateAgentInput, fields: fields([
    { name: 'agentName', type: 'string', required: true },
    { name: 'expectedSchema', type: 'object', required: true },
    { name: 'actualSchema', type: 'object', required: true },
  ]) }),
  'retro-schema-validator': Object.freeze({ contractVersion: 1, id: 'retro-schema-validator', entrypoint: 'skills/retro-schema-validator/src/index.js', exportName: 'validateFiles', argument: 'filePaths', readOnly: true, runtime: 'javascript', validate: validateRetroInput, fields: fields([
    { name: 'filePaths', type: 'paths', required: true, extension: '.json', minItems: 1, maxItems: 32, maxBytes: MAX_FILE_BYTES },
  ]) }),
});
export function getInvocationDescriptor(skillId) {
  if (!Object.hasOwn(descriptors, skillId)) throw error('INVALID_TARGET', 'Unknown pilot skill');
  return descriptors[skillId];
}
async function registered(descriptor, context) {
  const manifest = JSON.parse(await readFile(context.manifestPath ?? path.join(context.toolforgeRoot, 'manifest.json'), 'utf8'));
  const matches = Array.isArray(manifest.skills) ? manifest.skills.filter(s => s.id === descriptor.id) : [];
  const metadata = JSON.parse(await readFile(path.join(context.toolforgeRoot, 'skills', descriptor.id, 'skill.json'), 'utf8'));
  const localEntry = descriptor.entrypoint.slice(`skills/${descriptor.id}/`.length);
  if (matches.length !== 1 || matches[0].status !== 'active' || matches[0].runtime !== descriptor.runtime || matches[0].entrypoint !== localEntry || matches[0].version !== metadata.version || metadata.id !== descriptor.id || metadata.runtime !== descriptor.runtime || metadata.entrypoint !== localEntry) {
    throw error('REGISTRY_DRIFT', 'Installed pilot registration does not match reviewed descriptor');
  }
}
function jsonData(value, seen = new Set()) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value !== 'object' || seen.has(value)) return false;
  if (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) return false;
  seen.add(value);
  const valid = Reflect.ownKeys(value).every(k => typeof k === 'string') && Object.values(value).every(v => jsonData(v, seen));
  seen.delete(value);
  return valid;
}
function contained(root, file) {
  const relative = path.relative(root, file);
  return relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}
function safeAbsolute(value) {
  return typeof value === 'string' && value.trim() === value && value.length > 0 && path.isAbsolute(value) &&
    !/^[\\/]{2}/.test(value) && !value.includes('\0') && !value.split(/[\\/]/).includes('..') &&
    !value.replace(/^[A-Za-z]:/, '').includes(':') &&
    !value.split(/[\\/]/).some(part => /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part)) &&
    (process.platform !== 'win32' || /^[A-Za-z]:[\\/]/.test(value));
}
async function selectedPath(value, extension, field, context) {
  if (!safeAbsolute(value) || path.extname(value).toLowerCase() !== extension) invalid(field, `Select an absolute ${extension} file`);
  if (!Array.isArray(context.workspaceRoots) || !context.workspaceRoots.length) throw error('INVALID_CONTEXT', 'Workspace roots are required');
  let roots;
  try {
    roots = await Promise.all(context.workspaceRoots.map(async root => {
      if (!safeAbsolute(root)) throw new Error('root');
      const resolved = await realpath(root);
      if (!(await stat(resolved)).isDirectory()) throw new Error('root');
      return resolved;
    }));
  } catch { throw error('INVALID_CONTEXT', 'Workspace roots must be existing absolute directories'); }
  try {
    const resolved = await realpath(value);
    if (!safeAbsolute(resolved) || !roots.some(root => contained(root, resolved))) invalid(field, 'File must be within configured workspace roots');
    if (path.extname(resolved).toLowerCase() !== extension) invalid(field, `Select a ${extension} file`);
    const info = await stat(resolved);
    if (!info.isFile()) invalid(field, 'Select a regular file');
    if (info.size > MAX_FILE_BYTES) invalid(field, 'File exceeds 1 MiB');
    await access(resolved, constants.R_OK);
    const handle = await open(resolved, 'r');
    await handle.close();
    return resolved;
  } catch (cause) {
    if (cause.code === 'INVALID_INPUT') throw cause;
    invalid(field, 'File must exist and be readable');
  }
}
async function validateRoadmapInput(input, context) {
  for (const field of ['strict', 'verbose']) if (Object.hasOwn(input, field) && typeof input[field] !== 'boolean') invalid(field, 'Expected boolean');
  const file = await selectedPath(input.roadmapPath, '.md', 'roadmapPath', context);
  return { input: { roadmapPath: file, strict: input.strict ?? false, verbose: input.verbose ?? false }, readFiles: [file] };
}
async function validateAgentInput(input) {
  if (typeof input.agentName !== 'string' || !input.agentName.trim()) invalid('agentName', 'Expected nonempty agent name');
  for (const field of ['expectedSchema', 'actualSchema']) if (!object(input[field])) invalid(field, 'Expected JSON object');
  return { input: { agentName: input.agentName.trim(), expectedSchema: input.expectedSchema, actualSchema: input.actualSchema }, readFiles: [] };
}
async function validateRetroInput(input, context) {
  if (!Array.isArray(input.filePaths) || input.filePaths.length < 1 || input.filePaths.length > 32) invalid('filePaths', 'Select 1-32 files');
  const readFiles = [];
  for (let i = 0; i < input.filePaths.length; i++) readFiles.push(await selectedPath(input.filePaths[i], '.json', `filePaths.${i}`, context));
  const identities = readFiles.map(f => process.platform === 'win32' ? f.toLowerCase() : f);
  if (new Set(identities).size !== identities.length) invalid('filePaths', 'Duplicate file paths');
  return { input: { filePaths: readFiles }, readFiles };
}
export async function validateInvocationInput(skillId, input, context) {
  const descriptor = getInvocationDescriptor(skillId);
  if (context.signal?.aborted) throw error('CANCELLED', 'Invocation cancelled');
  try { await registered(descriptor, context); } catch (cause) {
    if (cause.code === 'REGISTRY_DRIFT') throw cause;
    throw error('REGISTRY_UNAVAILABLE', 'Installed pilot registration is unavailable');
  }
  if (!object(input)) invalid('input', 'Input must be a JSON object');
  try { if (!jsonData(input)) invalid('input', 'Input must contain only JSON data'); }
  catch (cause) { if (cause.code === 'INVALID_INPUT') throw cause; invalid('input', 'Input must contain only JSON data'); }
  if (Buffer.byteLength(JSON.stringify(input), 'utf8') > MAX_INPUT_BYTES) throw error('INPUT_TOO_LARGE', 'Input exceeds 64 KiB');
  const allowed = descriptor.fields.map(f => f.name);
  if (Object.keys(input).some(k => !allowed.includes(k))) invalid('input', 'Unknown input field');
  const normalized = await descriptor.validate(input, context);
  if (Buffer.byteLength(JSON.stringify(normalized.input), 'utf8') > MAX_INPUT_BYTES) throw error('INPUT_TOO_LARGE', 'Input exceeds 64 KiB');
  if (context.signal?.aborted) throw error('CANCELLED', 'Invocation cancelled');
  return normalized;
}

export async function inspectInvocation(skillId, context) {
  const descriptor = getInvocationDescriptor(skillId);
  const result = reason => ({ contractVersion: 1, fields: descriptor.fields, available: reason === null, reason });
  try {
    if (reviewed.contractVersion !== 1) return result('REVIEW_INCOMPLETE');
    if (!context.nodeExecutable || await realpath(context.nodeExecutable) !== await realpath(process.execPath) || Number(process.versions.node.split('.')[0]) !== 24) return result('RUNTIME_UNAVAILABLE');
    const root = await realpath(context.toolforgeRoot);
    if (await realpath(context.manifestPath ?? path.join(root, 'manifest.json')) !== await realpath(path.join(root, 'manifest.json'))) return result('REGISTRY_DRIFT');
    // Inspect bytes only: never import installed handlers to determine availability.
    const closure = [...reviewed.shared, ...reviewed.skills[skillId].files];
    for (const relative of closure) {
      const digest = reviewed.files[relative];
      if (digest === null) continue;
      if (!/^[a-f0-9]{64}$/.test(digest ?? '')) return result('REVIEW_INCOMPLETE');
      const file = await realpath(path.join(root, relative));
      if (!contained(root, file) || createHash('sha256').update(await readFile(file)).digest('hex') !== digest) return result('SOURCE_DRIFT');
    }
    for (const relative of [...reviewed.absent, ...reviewed.skills[skillId].absent]) {
      try { await stat(path.join(root, relative)); return result('SOURCE_DRIFT'); }
      catch (cause) { if (cause.code !== 'ENOENT') throw cause; }
    }
    await registered(descriptor, context);
    if (closure.some(relative => reviewed.files[relative] === null)) return result('REVIEW_INCOMPLETE');
    return result(null);
  } catch (cause) {
    return result(cause.code === 'REGISTRY_DRIFT' ? 'REGISTRY_DRIFT' : 'SOURCE_UNAVAILABLE');
  }
}

export function classifyInvocationResult(skillId, result) {
  getInvocationDescriptor(skillId);
  const malformed = () => { throw error('INVALID_RESULT', 'Malformed skill result'); };
  if (!object(result) || !jsonData(result)) malformed();
  if (skillId === 'agent-drift-detector') {
    if (!keys(result, ['agentName', 'driftDetected', 'missingFields', 'extraFields', 'recommendations']) || typeof result.agentName !== 'string' || !result.agentName.trim() || typeof result.driftDetected !== 'boolean' || !strings(result.missingFields) || !strings(result.extraFields) || !strings(result.recommendations) || result.driftDetected !== Boolean(result.missingFields.length || result.extraFields.length)) malformed();
    return result.driftDetected ? 'findings' : 'pass';
  }
  if (skillId === 'retro-schema-validator') {
    if (!keys(result, ['status', 'verdict', 'filesValidated', 'violations', 'timestamp']) || !integer(result.filesValidated) || result.filesValidated < 1 || result.filesValidated > 32 || !timestamp(result.timestamp) || !Array.isArray(result.violations)) malformed();
    for (const v of result.violations) if (!keys(v, ['file', 'field', 'level', 'message']) || !['error', 'warning'].includes(v.level) || ![v.file, v.field, v.message].every(x => typeof x === 'string')) malformed();
    const verdict = result.violations.some(v => v.level === 'error') ? 'RED' : result.violations.length ? 'YELLOW' : 'GREEN';
    if (result.verdict !== verdict || result.status !== (verdict === 'RED' ? 'error' : 'success')) malformed();
    return verdict === 'GREEN' ? 'pass' : 'findings';
  }
  if (!keys(result, ['status', 'message'], ['code', 'data']) || !['success', 'error'].includes(result.status) || typeof result.message !== 'string' || (Object.hasOwn(result, 'code') && typeof result.code !== 'string')) malformed();
  if (result.code === 'SKILL_ERROR') {
    if (result.status !== 'error') malformed();
    throw error('SKILL_ERROR', 'Skill execution failed');
  }
  if (Object.hasOwn(result, 'data')) {
    const d = result.data;
    if (!keys(d, ['isValid', 'findings', 'syncMarkersPresent', 'contentLength', 'validated']) || typeof d.isValid !== 'boolean' || typeof d.syncMarkersPresent !== 'boolean' || !integer(d.contentLength) || !timestamp(d.validated) || !Array.isArray(d.findings)) malformed();
    for (const f of d.findings) if (!keys(f, ['level', 'code', 'message'], ['line']) || !['error', 'warning', 'info'].includes(f.level) || typeof f.code !== 'string' || typeof f.message !== 'string' || (Object.hasOwn(f, 'line') && (!integer(f.line) || f.line < 1))) malformed();
    if (d.isValid === d.findings.some(f => f.level === 'error') || result.status !== (d.isValid ? 'success' : 'error')) malformed();
    return result.status === 'error' || d.findings.some(f => f.level !== 'info') ? 'findings' : 'pass';
  }
  if (result.status !== 'error' || !result.code) malformed();
  return 'findings';
}
