import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import os from "os";
import {
  parseQueueMarkdown,
  renderQueueMarkdown,
  reconcileQueue
} from "../src/core/reconciler.ts";
import type { DefectItem } from "../src/core/types.ts";
import * as trmDevops from "../src/index.ts";

test("renderQueueMarkdown generates markdown matching target schema", () => {
  const syncDate = new Date("2026-08-28T12:00:00.000Z");
  const items: DefectItem[] = [
    {
      id: "DEV-001",
      signatureHash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      parentHash: "NONE",
      sourceFingerprint: "8f4b23a1c9",
      status: "OPEN",
      title: "CI/CD Failure across main and feat/openrouter-oxalpha-integration",
      targetRepo: "sorensencc-dotcom/toolforge",
      failingWorkflows: [
        {
          name: "Governance",
          commitSha: "543b2e2",
          runId: "12345678",
          step: "Pre-Commit Lint"
        },
        {
          name: "Toolforge Release",
          commitSha: "0825b92",
          attempt: 1
        }
      ],
      blastRadius: "P0",
      primarySuspects: [
        "Strict branch lint or policy violation on feat/",
        "Token scope starvation on release runner"
      ],
      actionSteps: [
        "gh run view --repo sorensencc-dotcom/toolforge --log-failed",
        "pwsh -NoProfile -File C:\\dev\\scripts\\verify-repo-context.ps1 -Path C:\\dev\\sigil-repo"
      ],
      sourceId: "799f2eb8",
      firstSeen: "2026-08-28T11:30:00Z",
      lastObserved: "2026-08-28T11:45:00Z",
      lastAction: "2026-08-28T11:46:00Z",
      triageOwner: "@developer",
      tags: ["ci", "governance", "release"],
      operatorNotes: {
        context: "Investigating token permission discrepancy on workflow runner.",
        attemptedFixes: ["Staged pre-commit policy exemption check."],
        blockedOn: "Awaiting release secret propagation in GitHub repository settings."
      }
    }
  ];

  const md = renderQueueMarkdown(items, syncDate);

  assert.ok(md.startsWith("# Dev Triage Queue\n*Last Synced: 2026-08-28T12:00:00.000Z*\n\n## Active Defects\n\n"));
  assert.ok(md.includes("### [DEV-001] CI/CD Failure across main and feat/openrouter-oxalpha-integration"));
  assert.ok(md.includes("- **Status:** OPEN"));
  assert.ok(md.includes("- **Owner:** @developer"));
  assert.ok(md.includes("- **Tags:** `ci`, `governance`, `release`"));
  assert.ok(md.includes("- **Target Repo:** `sorensencc-dotcom/toolforge`"));
  assert.ok(md.includes("- **Failing Workflows:**"));
  assert.ok(md.includes("  - `Governance` (SHA: `543b2e2`, Run ID: `12345678`, Step: `Pre-Commit Lint`)"));
  assert.ok(md.includes("  - `Toolforge Release` (SHA: `0825b92`, Attempt: `1`)"));
  assert.ok(md.includes("- **Blast Radius:** P0"));
  assert.ok(md.includes("- **NotebookLM Source ID:** `799f2eb8`"));
  assert.ok(md.includes("- **Source Fingerprint:** `8f4b23a1c9`"));
  assert.ok(md.includes("- **Signature Hash:** `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`"));
  assert.ok(md.includes("- **Parent Hash:** `NONE`"));
  assert.ok(md.includes("- **First Seen:** 2026-08-28T11:30:00Z"));
  assert.ok(md.includes("- **Last Observed:** 2026-08-28T11:45:00Z"));
  assert.ok(md.includes("- **Last Action:** 2026-08-28T11:46:00Z"));
  assert.ok(md.includes("- **Primary Suspects:**\n  - Strict branch lint or policy violation on feat/\n  - Token scope starvation on release runner"));
  assert.ok(md.includes("- **Deterministic Action Steps:**\n  1. `gh run view --repo sorensencc-dotcom/toolforge --log-failed`\n  2. `pwsh -NoProfile -File C:\\dev\\scripts\\verify-repo-context.ps1 -Path C:\\dev\\sigil-repo`"));
  assert.ok(md.includes("<!-- operator-notes-start -->\n[context]: Investigating token permission discrepancy on workflow runner.\n[attempted-fixes]: Staged pre-commit policy exemption check.\n[blocked-on]: Awaiting release secret propagation in GitHub repository settings.\n<!-- operator-notes-end -->"));
});

test("parseQueueMarkdown parses rendered markdown back into DefectItem[]", () => {
  const syncDate = new Date("2026-08-28T12:00:00.000Z");
  const original: DefectItem[] = [
    {
      id: "DEV-001",
      signatureHash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      parentHash: "parent-hash-xyz",
      sourceFingerprint: "8f4b23a1c9",
      status: "IN_PROGRESS",
      title: "CI/CD Failure across main",
      targetRepo: "sorensencc-dotcom/toolforge",
      failingWorkflows: [
        {
          name: "Governance",
          commitSha: "543b2e2",
          runId: "12345678",
          job: "lint-job",
          step: "Pre-Commit Lint",
          runner: "ubuntu-latest",
          attempt: 2
        }
      ],
      blastRadius: "P1",
      primarySuspects: ["Suspect 1", "Suspect 2"],
      actionSteps: ["npm test", "npm run build"],
      sourceId: "src-uuid-99",
      firstSeen: "2026-08-28T11:30:00Z",
      lastObserved: "2026-08-28T11:45:00Z",
      lastAction: "2026-08-28T11:46:00Z",
      triageOwner: "@operator",
      tags: ["ci", "build"],
      operatorNotes: {
        context: "Context info",
        attemptedFixes: ["Fix A", "Fix B"],
        blockedOn: "Dependency issue"
      }
    }
  ];

  const md = renderQueueMarkdown(original, syncDate);
  const parsed = parseQueueMarkdown(md);

  assert.equal(parsed.length, 1);
  const item = parsed[0];
  assert.equal(item.id, "DEV-001");
  assert.equal(item.title, "CI/CD Failure across main");
  assert.equal(item.status, "IN_PROGRESS");
  assert.equal(item.triageOwner, "@operator");
  assert.deepEqual(item.tags, ["ci", "build"]);
  assert.equal(item.targetRepo, "sorensencc-dotcom/toolforge");
  assert.equal(item.blastRadius, "P1");
  assert.equal(item.signatureHash, "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  assert.equal(item.parentHash, "parent-hash-xyz");
  assert.equal(item.sourceId, "src-uuid-99");
  assert.equal(item.sourceFingerprint, "8f4b23a1c9");
  assert.equal(item.firstSeen, "2026-08-28T11:30:00Z");
  assert.equal(item.lastObserved, "2026-08-28T11:45:00Z");
  assert.equal(item.lastAction, "2026-08-28T11:46:00Z");
  assert.deepEqual(item.primarySuspects, ["Suspect 1", "Suspect 2"]);
  assert.deepEqual(item.actionSteps, ["npm test", "npm run build"]);
  assert.equal(item.failingWorkflows.length, 1);
  assert.equal(item.failingWorkflows[0].name, "Governance");
  assert.equal(item.failingWorkflows[0].commitSha, "543b2e2");
  assert.equal(item.failingWorkflows[0].runId, "12345678");
  assert.equal(item.failingWorkflows[0].job, "lint-job");
  assert.equal(item.failingWorkflows[0].step, "Pre-Commit Lint");
  assert.equal(item.failingWorkflows[0].runner, "ubuntu-latest");
  assert.equal(item.failingWorkflows[0].attempt, 2);
  assert.deepEqual(item.operatorNotes, {
    context: "Context info",
    attemptedFixes: ["Fix A", "Fix B"],
    blockedOn: "Dependency issue"
  });
});

test("parseQueueMarkdown parses raw text notes and handles missing optionals", () => {
  const rawMarkdown = `# Dev Triage Queue
*Last Synced: 2026-08-28T12:00:00Z*

## Active Defects

### [DEV-005] Minimal Defect
- **Status:** MUTED
- **Target Repo:** \`UNKNOWN\`
- **Blast Radius:** P3
- **NotebookLM Source ID:** \`src-local\`
- **Source Fingerprint:** \`fp-minimal\`
- **Signature Hash:** \`hash-minimal-555\`
- **Parent Hash:** \`NONE\`
- **First Seen:** 2026-08-28T10:00:00Z
- **Last Observed:** 2026-08-28T10:30:00Z
<!-- operator-notes-start -->
Unstructured free-form operator thoughts without bracket tags.
<!-- operator-notes-end -->
`;

  const parsed = parseQueueMarkdown(rawMarkdown);
  assert.equal(parsed.length, 1);
  const item = parsed[0];
  assert.equal(item.id, "DEV-005");
  assert.equal(item.title, "Minimal Defect");
  assert.equal(item.status, "MUTED");
  assert.equal(item.triageOwner, undefined);
  assert.deepEqual(item.tags, []);
  assert.equal(item.parentHash, undefined);
  assert.deepEqual(item.failingWorkflows, []);
  assert.deepEqual(item.primarySuspects, []);
  assert.deepEqual(item.actionSteps, []);
  assert.deepEqual(item.operatorNotes, {
    rawText: "Unstructured free-form operator thoughts without bracket tags."
  });
});

test("reconciler parses, preserves operator notes, merges, and is 10x idempotent", async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "reconcile-test-"));
  const queuePath = path.join(tmpDir, "queue.md");

  const initialItems: DefectItem[] = [
    {
      id: "DEV-001",
      signatureHash: "hash-001",
      sourceFingerprint: "fingerprint-001",
      status: "IN_PROGRESS",
      title: "Governance Lint Error",
      targetRepo: "sorensencc-dotcom/toolforge",
      failingWorkflows: [{ name: "Governance", commitSha: "543b2e2" }],
      blastRadius: "P0",
      primarySuspects: ["Branch rule violation"],
      actionSteps: ["gh run view --log-failed"],
      sourceId: "src-001",
      firstSeen: "2026-08-28T11:00:00Z",
      lastObserved: "2026-08-28T11:00:00Z",
      tags: ["ci"],
      operatorNotes: {
        context: "Investigating token scope",
        attemptedFixes: ["Regenerated token"],
        blockedOn: "Permissions"
      }
    }
  ];

  const initialMd = renderQueueMarkdown(initialItems, new Date("2026-08-28T11:00:00.000Z"));
  fs.writeFileSync(queuePath, initialMd, "utf8");

  const incoming: DefectItem[] = [
    {
      id: "DEV-NEW",
      signatureHash: "hash-001",
      sourceFingerprint: "fingerprint-001-updated",
      status: "OPEN",
      title: "Governance Lint Error",
      targetRepo: "sorensencc-dotcom/toolforge",
      failingWorkflows: [
        { name: "Governance", commitSha: "543b2e2" },
        { name: "Release", commitSha: "0825b92" }
      ],
      blastRadius: "P0",
      primarySuspects: ["Branch rule violation"],
      actionSteps: ["gh run view --log-failed"],
      sourceId: "src-001",
      firstSeen: "2026-08-28T11:00:00Z",
      lastObserved: "2026-08-28T11:45:00Z",
      tags: ["ci"]
    },
    {
      id: "DEV-NEW",
      signatureHash: "hash-002",
      sourceFingerprint: "fingerprint-002",
      status: "OPEN",
      title: "Missing Secret",
      targetRepo: "sorensencc-dotcom/toolforge",
      failingWorkflows: [{ name: "Release", commitSha: "0825b92" }],
      blastRadius: "P1",
      primarySuspects: ["NPM_TOKEN missing"],
      actionSteps: ["gh secret list"],
      sourceId: "src-002",
      firstSeen: "2026-08-28T11:45:00Z",
      lastObserved: "2026-08-28T11:45:00Z",
      tags: ["release"]
    }
  ];

  const merged = await reconcileQueue(queuePath, incoming);
  assert.equal(merged.length, 2);

  const updatedContent = fs.readFileSync(queuePath, "utf8");
  assert.ok(updatedContent.includes("- **Status:** IN_PROGRESS"));
  assert.ok(updatedContent.includes("[context]: Investigating token scope"));
  assert.ok(updatedContent.includes("[DEV-002] Missing Secret"));
  assert.ok(updatedContent.includes("- **Last Observed:** 2026-08-28T11:45:00Z"));
  assert.ok(updatedContent.includes("- **Source Fingerprint:** `fingerprint-001-updated`"));

  for (let i = 0; i < 10; i++) {
    const before = fs.readFileSync(queuePath, "utf8");
    await reconcileQueue(queuePath, incoming);
    const after = fs.readFileSync(queuePath, "utf8");
    assert.equal(before, after);
  }

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("reconcileQueue initializes new queue file and assigns sequential DEV IDs", async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "reconcile-new-"));
  const queuePath = path.join(tmpDir, "nested", "queue.md");

  const incoming: DefectItem[] = [
    {
      id: "DEV-NEW",
      signatureHash: "hash-a",
      sourceFingerprint: "fp-a",
      status: "OPEN",
      title: "First Novel Defect",
      targetRepo: "sorensencc-dotcom/toolforge",
      failingWorkflows: [{ name: "Build", commitSha: "111111" }],
      blastRadius: "P2",
      primarySuspects: ["Unknown"],
      actionSteps: ["npm test"],
      sourceId: "src-a",
      firstSeen: "2026-08-28T10:00:00Z",
      lastObserved: "2026-08-28T10:00:00Z",
      tags: ["test"]
    },
    {
      id: "DEV-NEW",
      signatureHash: "hash-b",
      sourceFingerprint: "fp-b",
      status: "OPEN",
      title: "Second Novel Defect",
      targetRepo: "sorensencc-dotcom/toolforge",
      failingWorkflows: [{ name: "Deploy", commitSha: "222222" }],
      blastRadius: "P0",
      primarySuspects: ["Deploy config missing"],
      actionSteps: ["flyctl status"],
      sourceId: "src-b",
      firstSeen: "2026-08-28T10:05:00Z",
      lastObserved: "2026-08-28T10:05:00Z",
      tags: ["deploy"]
    }
  ];

  const merged = await reconcileQueue(queuePath, incoming);
  assert.equal(merged.length, 2);
  assert.equal(merged[0].id, "DEV-001");
  assert.equal(merged[1].id, "DEV-002");
  assert.ok(fs.existsSync(queuePath));

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("index.ts re-exports reconciler functions", () => {
  assert.equal(typeof trmDevops.renderQueueMarkdown, "function");
  assert.equal(typeof trmDevops.parseQueueMarkdown, "function");
  assert.equal(typeof trmDevops.reconcileQueue, "function");
});
