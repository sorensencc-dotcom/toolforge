import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { resolve } from 'path';

interface BuildOptions {
  action: string;
  registry: string;
  workdir: string;
  dryRun: boolean;
  verbose: boolean;
}

interface ImageResult {
  name: string;
  status: string;
  digest?: string;
  error?: string;
}

const images = ['harness-v3', 'onnx-sidecar'];

function log(msg: string, verbose: boolean = true) {
  if (verbose) console.log(`[IMAGE-BUILD] ${msg}`);
}

function exec(cmd: string, dryRun: boolean, verbose: boolean = true): string {
  if (verbose) log(`$ ${cmd}`);
  if (dryRun) return '';
  return execSync(cmd, { encoding: 'utf-8' });
}

function buildImage(name: string, workdir: string, opts: BuildOptions): ImageResult {
  const dockerfilePath = resolve(workdir, name);
  if (!existsSync(dockerfilePath)) {
    return { name, status: 'failed', error: `${dockerfilePath} not found` };
  }

  try {
    log(`Building ${name}...`, opts.verbose);
    exec(`docker build -t ${name}:latest ${dockerfilePath}`, opts.dryRun, opts.verbose);
    return { name, status: 'built' };
  } catch (err: any) {
    return { name, status: 'failed', error: err.message };
  }
}

function tagImage(name: string, registry: string, opts: BuildOptions): ImageResult {
  try {
    log(`Tagging ${name}...`, opts.verbose);
    exec(`docker tag ${name}:latest ${registry}/${name}:latest`, opts.dryRun, opts.verbose);
    return { name, status: 'tagged' };
  } catch (err: any) {
    return { name, status: 'failed', error: err.message };
  }
}

function pushImage(name: string, registry: string, opts: BuildOptions): ImageResult {
  try {
    log(`Pushing ${name}...`, opts.verbose);
    exec(`docker push ${registry}/${name}:latest`, opts.dryRun, opts.verbose);
    return { name, status: 'pushed' };
  } catch (err: any) {
    return { name, status: 'failed', error: err.message };
  }
}

function verifyRegistry(registry: string, opts: BuildOptions): ImageResult {
  try {
    log(`Verifying registry catalog...`, opts.verbose);
    const output = exec(`curl -s ${registry}/v2/_catalog`, opts.dryRun, opts.verbose);
    const catalog = JSON.parse(output);
    const found = images.filter((img) => catalog.repositories?.includes(img) || false);
    return { name: 'registry', status: 'verified', digest: found.join(', ') };
  } catch (err: any) {
    return { name: 'registry', status: 'failed', error: err.message };
  }
}

function importNodeLocal(opts: BuildOptions): ImageResult[] {
  const results: ImageResult[] = [];
  for (const name of images) {
    try {
      log(`Importing ${name} to containerd...`, opts.verbose);
      exec(`docker save ${name}:latest -o /tmp/${name}.tar`, opts.dryRun, opts.verbose);
      exec(`sudo ctr -n k8s.io images import /tmp/${name}.tar`, opts.dryRun, opts.verbose);
      results.push({ name, status: 'imported' });
    } catch (err: any) {
      results.push({ name, status: 'failed', error: err.message });
    }
  }
  return results;
}

export async function main(args: Partial<BuildOptions> = {}) {
  const opts: BuildOptions = {
    action: args.action || 'all',
    registry: args.registry || 'registry.internal:5000',
    workdir: args.workdir || '.',
    dryRun: args.dryRun ?? false,
    verbose: args.verbose ?? true,
  };

  const startTime = Date.now();
  let results: ImageResult[] = [];

  log(`Starting ${opts.action} action...`, opts.verbose);

  try {
    switch (opts.action) {
      case 'build':
        results = images.map((img) => buildImage(img, opts.workdir, opts));
        break;
      case 'tag':
        results = images.map((img) => tagImage(img, opts.registry, opts));
        break;
      case 'push':
        results = images.map((img) => pushImage(img, opts.registry, opts));
        break;
      case 'verify':
        results = [verifyRegistry(opts.registry, opts)];
        break;
      case 'import':
        results = importNodeLocal(opts);
        break;
      case 'all':
        for (const img of images) {
          results.push(buildImage(img, opts.workdir, opts));
          results.push(tagImage(img, opts.registry, opts));
          results.push(pushImage(img, opts.registry, opts));
        }
        results.push(verifyRegistry(opts.registry, opts));
        break;
      default:
        throw new Error(`Unknown action: ${opts.action}`);
    }

    const duration = Date.now() - startTime;
    const hasErrors = results.some((r) => r.status === 'failed');

    if (hasErrors) {
      const errors = results.filter((r) => r.status === 'failed');
      throw new Error(
        `${errors.length} image(s) failed: ${errors.map((e) => `${e.name} (${e.error})`).join(', ')}`
      );
    }

    log(`✓ All steps completed in ${duration}ms`, opts.verbose);

    return {
      status: 'ok',
      message: `All images ${opts.action === 'all' ? 'built, tagged, pushed, and verified' : opts.action}`,
      data: {
        action: opts.action,
        images: results,
        registry: opts.registry,
        duration_ms: duration,
      },
    };
  } catch (error: any) {
    return {
      status: 'error',
      message: error.message || 'Unknown error',
      data: null,
    };
  }
}

// CLI entrypoint
if (require.main === module) {
  const args = process.argv.slice(2);
  const opts: Partial<BuildOptions> = {};

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--action') opts.action = args[++i];
    if (args[i] === '--registry') opts.registry = args[++i];
    if (args[i] === '--workdir') opts.workdir = args[++i];
    if (args[i] === '--dry-run') opts.dryRun = true;
    if (args[i] === '--verbose') opts.verbose = args[++i] !== 'false';
  }

  main(opts).then((result) => {
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.status === 'ok' ? 0 : 1);
  });
}
