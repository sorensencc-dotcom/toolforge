#!/usr/bin/env node

/**
 * TRM Tier-1 Diagnostic Engine: TinyFish Fast Triage
 * Parses log signatures locally for known failure modes (submodule auth, node deprecations).
 * Falls back to TinyFish CLI search for fast zero-token diagnostics.
 *
 * Usage: node trm-tinyfish-triage.mjs "<raw_log_or_stack_trace>"
 */

import { execFileSync } from "node:child_process";

const KNOWN_SIGNATURES = [
  {
    name: "GIT_SUBMODULE_AUTH_ERROR",
    pattern: /fatal:\s+could not read Username for 'https:\/\/github\.com':\s+No such device or address|exit code 128/i,
    confidence: 0.98,
    diagnosis: "Submodule authentication failed. Standard GITHUB_TOKEN lacks cross-repository read permissions.",
    patch: {
      action: "UPDATE_WORKFLOW_CHECKOUT",
      description: "Upgrade actions/checkout to v4, configure token with secrets.SUBMODULE_ACCESS_TOKEN, and enable recursive submodules.",
      target: ".github/workflows/nightly-validator.yml",
      yamlPatch: `      - name: Checkout Code\n        uses: actions/checkout@v4\n        with:\n          token: \${{ secrets.SUBMODULE_ACCESS_TOKEN }}\n          submodules: 'recursive'`
    }
  },
  {
    name: "NODE_RUNNER_DEPRECATION",
    pattern: /Node\.js 16 actions are deprecated|Node\.js 20 actions are deprecated/i,
    confidence: 0.95,
    diagnosis: "Outdated GitHub Action runner version detected.",
    patch: {
      action: "UPGRADE_ACTION_VERSIONS",
      description: "Upgrade setup-node and checkout actions to @v4 targeting Node 24.",
      target: ".github/workflows/nightly-validator.yml",
      yamlPatch: `      - name: Setup Node.js\n        uses: actions/setup-node@v4\n        with:\n          node-version: '24'\n          cache: 'npm'`
    }
  }
];

export async function runTinyFishTriage(rawLog) {
  // Step 1: Check deterministic local signature library
  for (const sig of KNOWN_SIGNATURES) {
    if (sig.pattern.test(rawLog)) {
      return {
        status: "RESOLVED_LOCAL",
        engine: "TRM Local Signature Engine",
        confidence: sig.confidence,
        signature: sig.name,
        diagnosis: sig.diagnosis,
        patch: sig.patch
      };
    }
  }

  // Step 2: Query TinyFish CLI for fast triage
  console.log("[Tier-1] No local signature matched. Executing TinyFish search triage...");
  try {
    const searchTerms = rawLog.split("\n")[0].slice(0, 120).replace(/["'`]/g, "");
    const output = execFileSync("tinyfish", ["search", "query", `GitHub Actions ${searchTerms}`], {
      encoding: "utf8",
      timeout: 5000,
      stdio: ["ignore", "pipe", "pipe"]
    });

    return {
      status: "TRIAGED_EXTERNAL",
      engine: "TinyFish Search CLI",
      confidence: 0.75,
      query: searchTerms,
      rawSummary: output.slice(0, 500),
      escalationRecommended: true
    };
  } catch (err) {
    return {
      status: "LOW_CONFIDENCE",
      engine: "TinyFish Search CLI",
      confidence: 0.0,
      error: err.message,
      escalationRecommended: true
    };
  }
}

// CLI Execution Support
if (process.argv[1] && process.argv[1].endsWith("trm-tinyfish-triage.mjs")) {
  const inputLog = process.argv[2] || "";
  if (!inputLog) {
    console.error("Usage: node trm-tinyfish-triage.mjs \"<log_string>\"");
    process.exit(1);
  }
  runTinyFishTriage(inputLog).then((res) => {
    console.log(JSON.stringify(res, null, 2));
  });
}
