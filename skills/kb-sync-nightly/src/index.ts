import { execSync } from 'child_process'; // noqa: SEC-AUDITOR
import path from 'path';
import fs from 'fs';

function findGitRoot(startDir: string): string | null {
    let dir = startDir;
    while (true) {
        if (fs.existsSync(path.join(dir, '.git'))) {
            return dir;
        }
        const parent = path.dirname(dir);
        if (parent === dir) {
            return null;
        }
        dir = parent;
    }
}

let projectRoot: string;
const gitRoot = findGitRoot(process.cwd());
if (gitRoot) {
    const kbSyncDir = gitRoot.toLowerCase().endsWith('kb-sync') ? gitRoot : path.join(gitRoot, 'kb-sync');
    projectRoot = fs.existsSync(kbSyncDir) ? kbSyncDir : gitRoot;
} else {
    projectRoot = path.resolve(process.cwd());
}

console.log(`[Nightly] Project root resolved to: ${projectRoot}`);

// Execute Stage 0: TRM Competitor Watchlist Drift Checks
try {
    console.log("[Nightly] Running Stage 0 TRM Competitor Drift Monitoring...");
    const watcherScript = path.join(projectRoot, 'watch-competitors-v2.mjs');
    const watchlistDir = path.join(projectRoot, 'trm', 'watchlists');

    if (fs.existsSync(watcherScript) && fs.existsSync(watchlistDir)) {
        const files = fs.readdirSync(watchlistDir).filter(f => f.endsWith('.json'));
        for (const file of files) {
            const fullPath = path.join(watchlistDir, file);
            console.log(`[Nightly] Checking watchlist: ${file}`);
            execSync(`node "${watcherScript}" "${fullPath}"`, { stdio: "inherit", cwd: projectRoot }); // noqa: SEC-AUDITOR
        }
    }
} catch (err) {
    console.warn("[Nightly Warning] Stage 0 Competitor Drift Monitoring encountered an issue. Continuing downstream sync in fail-soft mode.");
}

// Execute Stage 1: Ingestion & Validation Checks
try {
    console.log("[Nightly] Running Stage 1 Knowledge Base Sync...");
    execSync("npm run kb:sync:all", { stdio: "inherit", cwd: projectRoot }); // noqa: SEC-AUDITOR
} catch (err) {
    console.error("[Nightly Error] Stage 1 Sync failed.");
    process.exit(1);
}

// Execute Stage 2: Wiki Semantic Synthesis
try {
    console.log("[Nightly] Launching Stage 2 Wiki Semantic Synthesis...");
    execSync("npm run wiki:ingest:obsidian:validate", { stdio: "inherit", cwd: projectRoot }); // noqa: SEC-AUDITOR
} catch (err) {
    console.error("[Nightly Error] Stage 2 Synthesis failed.");
    process.exit(1);
}
