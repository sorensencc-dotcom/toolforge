import test from "node:test";
import assert from "node:assert/strict";
import { runTinyFishTriage } from "./trm-tinyfish-triage.mjs";
import { requestSigilVerification } from "./trm-sigil-guard.mjs";

test("Tier 1: Accurately identifies Git exit code 128 submodule error", async () => {
  const sampleLog = "fatal: could not read Username for 'https://github.com': No such device or address `git submodule update` failed with exit code 128";
  const result = await runTinyFishTriage(sampleLog);

  assert.equal(result.status, "RESOLVED_LOCAL");
  assert.equal(result.signature, "GIT_SUBMODULE_AUTH_ERROR");
  assert.ok(result.confidence >= 0.95);
  assert.ok(result.patch.yamlPatch.includes("submodules: 'recursive'"));
  assert.ok(result.patch.yamlPatch.includes("secrets.SUBMODULE_ACCESS_TOKEN"));
});

test("Tier 1: Accurately identifies Node.js runner deprecation warning", async () => {
  const sampleLog = "Node.js 20 actions are deprecated. Please update the following actions to use Node.js 24: actions/checkout@v3";
  const result = await runTinyFishTriage(sampleLog);

  assert.equal(result.status, "RESOLVED_LOCAL");
  assert.equal(result.signature, "NODE_RUNNER_DEPRECATION");
  assert.ok(result.confidence >= 0.95);
  assert.ok(result.patch.yamlPatch.includes("node-version: '24'"));
});

test("Sigil Guard: Successfully processes valid patch payload in shadow/dry-run mode", async () => {
  const samplePatch = {
    action: "UPDATE_WORKFLOW_CHECKOUT",
    description: "Upgrade actions/checkout to v4",
    target: ".github/workflows/nightly-validator.yml",
    yamlPatch: "uses: actions/checkout@v4"
  };

  const isApproved = await requestSigilVerification(samplePatch);
  assert.equal(isApproved, true);
});
