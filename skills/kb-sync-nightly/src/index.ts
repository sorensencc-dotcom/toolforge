import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

let projectRoot: string;
try {
    const gitRoot = execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim();
    projectRoot = gitRoot.endsWith('kb-sync') ? gitRoot : path.join(gitRoot, 'kb-sync');
    if (!fs.existsSync(projectRoot)) {
        projectRoot = gitRoot;
    }
} catch {
    projectRoot = path.resolve(process.cwd());
}

console.log(`[Nightly] Project root resolved to: ${projectRoot}`);

// Execute Stage 1: Ingestion & Validation Checks
try {
    console.log("[Nightly] Running Stage 1 Knowledge Base Sync...");
    execSync("npm run kb:sync:all", { stdio: "inherit", cwd: projectRoot });
} catch (err) {
    console.error("[Nightly Error] Stage 1 Sync failed.");
    process.exit(1);
}

// Execute Stage 2: Wiki Semantic Synthesis
try {
    console.log("[Nightly] Launching Stage 2 Wiki Semantic Synthesis...");
    execSync("npm run wiki:ingest:obsidian:validate", { stdio: "inherit", cwd: projectRoot });
} catch (err) {
    console.error("[Nightly Error] Stage 2 Synthesis failed.");
    process.exit(1);
}
