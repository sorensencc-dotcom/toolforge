import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Console } from 'node:console';
import { validateInvocationInput, getInvocationDescriptor, classifyInvocationResult, MAX_INPUT_BYTES, MAX_FILE_BYTES } from './invocation-contracts.mjs';
import { invocationFailure, invocationEnvelope, MAX_WORKER_FRAMING_BYTES, MAX_WORKER_REQUEST_BYTES } from './invoke-skill.mjs';
import reviewed from './invocation-reviewed.json' with { type: 'json' };

const fail = code => { throw Object.assign(new Error(code), { code }); };
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
function contained(root, file) {
  const relative = path.relative(root, file);
  return relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}
function safePath(file) {
  return typeof file === 'string' && path.isAbsolute(file) && !/^[\\/]{2}/.test(file) && !file.includes('\0') && !file.replace(/^[a-z]:/i, '').includes(':') && !file.split(/[\\/]/).includes('..') && !file.split(/[\\/]/).some(part => /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part));
}
async function verifySources(skillId, context) {
  if (Number(process.versions.node.split('.')[0]) !== 24 || !process.permission || process.permission.has('fs.write') || process.permission.has('child') || process.permission.has('worker') || process.permission.has('addons') || process.permission.has('wasi')) fail('RUNTIME_UNAVAILABLE');
  const descriptor = getInvocationDescriptor(skillId);
  if (reviewed.contractVersion !== 1 || !safePath(context.toolforgeRoot)) fail('SOURCE_DRIFT');
  for (const relative of [...reviewed.shared, ...reviewed.skills[skillId].files]) {
    const file = path.join(context.toolforgeRoot, relative);
    const resolved = await fs.realpath(file);
    if (!contained(context.toolforgeRoot, resolved) || !/^[a-f0-9]{64}$/.test(reviewed.files[relative] ?? '') || createHash('sha256').update(await fs.readFile(resolved)).digest('hex') !== reviewed.files[relative]) fail('SOURCE_DRIFT');
  }
  for (const relative of [...reviewed.absent, ...reviewed.skills[skillId].absent]) {
    try { await fs.stat(path.join(context.toolforgeRoot, relative)); fail('SOURCE_DRIFT'); }
    catch (cause) { if (cause.code !== 'ENOENT') fail('SOURCE_DRIFT'); }
  }
  const manifest = JSON.parse(await fs.readFile(path.join(context.toolforgeRoot, 'manifest.json'), 'utf8'));
  const metadata = JSON.parse(await fs.readFile(path.join(context.toolforgeRoot, 'skills', skillId, 'skill.json'), 'utf8'));
  const matches = manifest.skills.filter(skill => skill.id === skillId);
  const localEntry = descriptor.entrypoint.slice(`skills/${skillId}/`.length);
  if (matches.length !== 1 || matches[0].status !== 'active' || matches[0].runtime !== descriptor.runtime || matches[0].entrypoint !== localEntry || matches[0].version !== metadata.version || metadata.id !== skillId || metadata.runtime !== descriptor.runtime || metadata.entrypoint !== localEntry) fail('SOURCE_DRIFT');
  return descriptor;
}
async function verifyInput(skillId, input, context) {
  if (skillId === 'agent-drift-detector') return (await validateInvocationInput(skillId, input, context)).input;
  const allowed = skillId === 'roadmap-validator' ? ['roadmapPath', 'strict', 'verbose'] : ['filePaths'];
  if (!object(input) || Object.keys(input).some(k => !allowed.includes(k))) fail('INVALID_INPUT');
  if (!Array.isArray(context.workspaceRoots) || !context.workspaceRoots.every(safePath)) fail('RUNTIME_UNAVAILABLE');
  const files = skillId === 'roadmap-validator' ? [input.roadmapPath] : input.filePaths;
  if (!Array.isArray(files) || files.length < 1 || files.length > 32 || (skillId === 'roadmap-validator' && (typeof input.strict !== 'boolean' || typeof input.verbose !== 'boolean'))) fail('INVALID_INPUT');
  const identities = new Set();
  for (const file of files) {
    if (!safePath(file)) fail('INVALID_INPUT');
    let resolved, info;
    try { resolved = await fs.realpath(file); info = await fs.stat(resolved); }
    catch { fail('INVALID_INPUT'); }
    const identity = process.platform === 'win32' ? resolved.toLowerCase() : resolved;
    if (!safePath(resolved) || path.extname(resolved).toLowerCase() !== (skillId === 'roadmap-validator' ? '.md' : '.json') || !context.workspaceRoots.some(root => contained(root, resolved)) || !info.isFile() || info.size > MAX_FILE_BYTES || identities.has(identity)) fail('INVALID_INPUT');
    identities.add(identity);
    const handle = await fs.open(resolved, 'r'); await handle.close();
  }
  return input;
}
export async function runInvocationWorker() {
  const start = performance.now();
  let skillId = null;
  let envelope;
  // Console writes use stderr; raw stdout remains exclusively protocol output.
  globalThis.console = new Console({ stdout: process.stderr, stderr: process.stderr });
  try {
    const chunks = [];
    let bytes = 0;
    for await (const chunk of process.stdin) {
      bytes += chunk.length;
      if (bytes > MAX_WORKER_REQUEST_BYTES) fail('WORKER_FAILED');
      chunks.push(chunk);
    }
    let request;
    try { request = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks))); }
    catch { fail('INVALID_JSON'); }
    if (!object(request) || request.contractVersion !== 1 || Object.keys(request).length !== 4 || !['contractVersion', 'skillId', 'input', 'context'].every(k => Object.hasOwn(request, k)) || !object(request.context) || Object.keys(request.context).length !== 3 || !['toolforgeRoot', 'workspaceRoots', 'nodeExecutable'].every(k => Object.hasOwn(request.context, k))) fail('WORKER_FAILED');
    if (typeof request.skillId !== 'string') fail('INVALID_TARGET');
    getInvocationDescriptor(request.skillId); skillId = request.skillId;
    const inputBytes = Buffer.byteLength(JSON.stringify(request.input));
    if (inputBytes > MAX_INPUT_BYTES) fail('PAYLOAD_TOO_LARGE');
    if (Buffer.byteLength(JSON.stringify(request)) - inputBytes > MAX_WORKER_FRAMING_BYTES) fail('INVALID_CONTEXT');
    let descriptor;
    try { descriptor = await verifySources(skillId, request.context); }
    catch (cause) { fail(cause.code === 'RUNTIME_UNAVAILABLE' ? cause.code : 'SOURCE_DRIFT'); }
    const input = await verifyInput(skillId, request.input, request.context);
    const module = await import(pathToFileURL(path.join(request.context.toolforgeRoot, descriptor.entrypoint)).href);
    if (typeof module[descriptor.exportName] !== 'function') fail('WORKER_FAILED');
    const result = await module[descriptor.exportName](descriptor.argument === 'filePaths' ? input.filePaths : input);
    const outcome = classifyInvocationResult(skillId, result);
    envelope = { ...invocationEnvelope(skillId, 'completed'), outcome, result };
  } catch (cause) { envelope = invocationFailure(skillId, cause); }
  envelope.durationMs = Math.max(0, performance.now() - start);
  process.stdout.write(JSON.stringify(envelope));
}
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) await runInvocationWorker();
