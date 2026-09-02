"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.main = main;
const child_process_1 = require("child_process");
const fs_1 = require("fs");
const path_1 = require("path");
const images = ['harness-v3', 'onnx-sidecar'];
function log(msg, verbose = true) {
    if (verbose)
        console.log(`[IMAGE-BUILD] ${msg}`);
}
function exec(cmd, dryRun, verbose = true) {
    if (verbose)
        log(`$ ${cmd}`);
    if (dryRun)
        return '';
    return (0, child_process_1.execSync)(cmd, { encoding: 'utf-8' });
}
function buildImage(name, workdir, opts) {
    const dockerfilePath = (0, path_1.resolve)(workdir, name);
    if (!(0, fs_1.existsSync)(dockerfilePath)) {
        return { name, status: 'failed', error: `${dockerfilePath} not found` };
    }
    try {
        log(`Building ${name}...`, opts.verbose);
        exec(`docker build -t ${name}:latest ${dockerfilePath}`, opts.dryRun, opts.verbose);
        return { name, status: 'built' };
    }
    catch (err) {
        return { name, status: 'failed', error: err.message };
    }
}
function tagImage(name, registry, opts) {
    try {
        log(`Tagging ${name}...`, opts.verbose);
        exec(`docker tag ${name}:latest ${registry}/${name}:latest`, opts.dryRun, opts.verbose);
        return { name, status: 'tagged' };
    }
    catch (err) {
        return { name, status: 'failed', error: err.message };
    }
}
function pushImage(name, registry, opts) {
    try {
        log(`Pushing ${name}...`, opts.verbose);
        exec(`docker push ${registry}/${name}:latest`, opts.dryRun, opts.verbose);
        return { name, status: 'pushed' };
    }
    catch (err) {
        return { name, status: 'failed', error: err.message };
    }
}
function verifyRegistry(registry, opts) {
    try {
        log(`Verifying registry catalog...`, opts.verbose);
        const output = exec(`curl -s ${registry}/v2/_catalog`, opts.dryRun, opts.verbose);
        const catalog = JSON.parse(output);
        const found = images.filter((img) => catalog.repositories?.includes(img) || false);
        return { name: 'registry', status: 'verified', digest: found.join(', ') };
    }
    catch (err) {
        return { name: 'registry', status: 'failed', error: err.message };
    }
}
function importNodeLocal(opts) {
    const results = [];
    for (const name of images) {
        try {
            log(`Importing ${name} to containerd...`, opts.verbose);
            exec(`docker save ${name}:latest -o /tmp/${name}.tar`, opts.dryRun, opts.verbose);
            exec(`sudo ctr -n k8s.io images import /tmp/${name}.tar`, opts.dryRun, opts.verbose);
            results.push({ name, status: 'imported' });
        }
        catch (err) {
            results.push({ name, status: 'failed', error: err.message });
        }
    }
    return results;
}
async function main(args = {}) {
    const opts = {
        action: args.action || 'all',
        registry: args.registry || 'registry.internal:5000',
        workdir: args.workdir || '.',
        dryRun: args.dryRun ?? false,
        verbose: args.verbose ?? true,
    };
    const startTime = Date.now();
    let results = [];
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
            throw new Error(`${errors.length} image(s) failed: ${errors.map((e) => `${e.name} (${e.error})`).join(', ')}`);
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
    }
    catch (error) {
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
    const opts = {};
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--action')
            opts.action = args[++i];
        if (args[i] === '--registry')
            opts.registry = args[++i];
        if (args[i] === '--workdir')
            opts.workdir = args[++i];
        if (args[i] === '--dry-run')
            opts.dryRun = true;
        if (args[i] === '--verbose')
            opts.verbose = args[++i] !== 'false';
    }
    main(opts).then((result) => {
        console.log(JSON.stringify(result, null, 2));
        process.exit(result.status === 'ok' ? 0 : 1);
    });
}
//# sourceMappingURL=index.js.map