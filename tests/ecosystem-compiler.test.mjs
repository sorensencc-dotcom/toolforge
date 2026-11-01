import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import {
  extractRepoTopology,
  extractMcpTopology,
  extractNotebookDirectory,
  extractTrailSkeletons,
  compileEcosystemGuide,
  generateAndWriteGuide,
  generateAndWriteGuideAsync,
  DEFAULT_REPO_ROOTS,
  DEFAULT_MCP_DIR,
  DEFAULT_REGISTRY_PATH,
  DEFAULT_CONTRACT_HUBS,
  DRIVE_MASTER_URL
} from '../scripts/ecosystem-compiler.mjs';

describe('Ecosystem Compiler Suite', () => {
  it('extractRepoTopology handles non-existent paths cleanly without throwing', () => {
    const bogusPaths = [
      path.join(os.tmpdir(), 'bogus-repo-1-' + Date.now()),
      path.join(os.tmpdir(), 'bogus-repo-2-' + Date.now())
    ];
    const repos = extractRepoTopology(bogusPaths);
    assert.deepEqual(repos, []);
  });

  it('extractRepoTopology extracts git metadata for valid local repositories', () => {
    const repos = extractRepoTopology(['C:\\dev']);
    assert.equal(repos.length, 1);
    const repo = repos[0];
    assert.equal(repo.name, 'dev');
    assert.equal(repo.path, 'C:\\dev');
    assert.ok(typeof repo.branch === 'string' && repo.branch.length > 0);
    assert.ok(typeof repo.lastCommitHash === 'string' && repo.lastCommitHash.length > 0);
    assert.ok(typeof repo.lastCommitMessage === 'string' && repo.lastCommitMessage.length > 0);
    assert.ok(typeof repo.lastCommitDate === 'string' && repo.lastCommitDate.length > 0);
    assert.equal(repo.active, true);
  });

  it('extractMcpTopology handles non-existent paths cleanly without throwing', () => {
    const bogusMcpDir = path.join(os.tmpdir(), 'bogus-mcp-' + Date.now());
    const mcps = extractMcpTopology(bogusMcpDir);
    assert.deepEqual(mcps, []);
  });

  it('extractMcpTopology extracts servers and tool counts from canonical MCP directory', () => {
    const mcps = extractMcpTopology(DEFAULT_MCP_DIR);
    assert.ok(Array.isArray(mcps));
    assert.ok(mcps.length >= 10, `Expected at least 10 MCP servers, got ${mcps.length}`);

    const serverNames = mcps.map(m => m.name);
    assert.ok(serverNames.includes('ijfw-memory'));

    const ijfw = mcps.find(m => m.name === 'ijfw-memory');
    assert.ok(ijfw.toolCount >= 5);
    assert.ok(ijfw.tools.includes('ijfw_memory_facts'));
  });

  it('extractNotebookDirectory handles non-existent registry path cleanly', () => {
    const bogusReg = path.join(os.tmpdir(), 'bogus-reg-' + Date.now() + '.json');
    const result = extractNotebookDirectory(bogusReg);
    assert.equal(result.totalCount, 0);
    assert.deepEqual(result.categories['Operational'], []);
    assert.deepEqual(result.categories['Core Software Architecture'], []);
    assert.deepEqual(result.categories['Historical CIC'], []);
    assert.deepEqual(result.categories['Personal OS'], []);
  });

  it('extractNotebookDirectory accurately categorizes all 31 notebooks', () => {
    const result = extractNotebookDirectory(DEFAULT_REGISTRY_PATH);
    assert.equal(result.totalCount, 31);
    assert.equal(result.categories['Historical CIC'].length, 15);
    assert.equal(result.categories['Core Software Architecture'].length, 5);
    assert.equal(result.categories['Personal OS'].length, 1);
    assert.equal(result.categories['Operational'].length, 10);
  });

  it('extractTrailSkeletons extracts AST signatures for valid contract hubs', () => {
    const hubs = [
      {
        subsystem: 'sigil-repo',
        repo: 'C:\\dev\\sigil-repo',
        file: 'sigil/relay/v1/room-routes.mjs',
        role: 'Room routes'
      }
    ];
    const skeletons = extractTrailSkeletons(hubs);
    assert.equal(skeletons.length, 1);
    assert.equal(skeletons[0].subsystem, 'sigil-repo');
    assert.ok(Array.isArray(skeletons[0].signatures));
    assert.ok(skeletons[0].signatures.length > 0);
    const joined = skeletons[0].signatures.join(' ');
    assert.ok(joined.includes('handleRoomRoute') || joined.includes('function'));
  });

  it('compileEcosystemGuide produces expected markdown sections, ports, and links', () => {
    const repos = [
      {
        name: 'dev',
        path: 'C:\\dev',
        branch: 'main',
        lastCommitHash: 'abc1234',
        lastCommitMessage: 'feat: add compiler',
        lastCommitDate: '2026-10-19 12:00:00 -0400',
        active: true
      }
    ];

    const mcps = [
      {
        name: 'graft',
        toolCount: 6,
        tools: ['graft_check_freshness', 'graft_repo_map']
      }
    ];

    const notebooks = {
      categories: {
        'Historical CIC': [{ id: '679b8bab-2d87-42cb-a726-6dc54c83acc2', title: 'CIC-KB' }]
      }
    };

    const skeletons = [
      {
        subsystem: 'sigil-repo',
        repo: 'C:\\dev\\sigil-repo',
        file: 'sigil/relay/v1/room-routes.mjs',
        role: 'Room message dispatch & SSE stream session lifecycle',
        signatures: ['- L23-L27  function send  function send(response, requestId, status, body)']
      }
    ];

    const fixedTime = new Date('2026-10-19T14:00:00.000Z');
    const md = compileEcosystemGuide({ repos, mcps, notebooks, skeletons, timestamp: fixedTime });

    assert.ok(md.includes('# Ecosystem Architecture Guide (Current)'));
    assert.ok(md.includes('> **Document Status:** Authoritative Architectural Standard'));
    assert.ok(md.includes('> **Last Synchronized:** 2026-10-19T14:00:00.000Z'));
    assert.ok(md.includes(`> **Drive Master:** [Ecosystem Architecture Guide (Current).md](${DRIVE_MASTER_URL})`));
    assert.ok(md.includes('## 1. Core Repositories & Engine Status (Knowledge Plane Partitioning)'));
    assert.ok(md.includes('## 2. Active Repository Commit Topology'));
    assert.ok(md.includes('## 3. Active MCP Tooling & Server Topology'));
    assert.ok(md.includes('## 4. Local Service Ports & Active System Topology'));
    assert.ok(md.includes('## 5. Target Notebook Cluster Directory'));
    assert.ok(md.includes('## 6. Cross-Subsystem Architectural & Sequence Flow Diagrams'));
    assert.ok(md.includes('## 7. High-Gravity Architectural Contract Hubs (Trail AST Skeletons)'));
    assert.ok(md.includes('## 8. Authoritative Agent & CLI Invariant Rules (Source of Truth)'));

    assert.ok(md.includes('```mermaid'));
    assert.ok(md.includes('`3000 / 8080`'));
    assert.ok(md.includes('`5000 / 5050`'));
    assert.ok(md.includes('`8765`'));
    assert.ok(md.includes('`11434`'));

    assert.ok(md.includes('| **dev** | `main` | `abc1234` feat: add compiler | 2026-10-19 12:00:00 -0400 |'));
    assert.ok(md.includes('| Historical CIC | `679b8bab-2d87-42cb-a726-6dc54c83acc2` | CIC-KB |'));
    assert.ok(md.includes('### Subsystem: `sigil-repo`'));
    assert.ok(md.includes('function send'));
  });

  it('generateAndWriteGuide writes valid file atomically and returns accurate summary', () => {
    const tmpOut = path.join(os.tmpdir(), `test-eco-guide-${Date.now()}.md`);
    try {
      const summary = generateAndWriteGuide(tmpOut);
      assert.equal(summary.outputPath, tmpOut);
      assert.ok(summary.repoCount >= 1);
      assert.ok(summary.mcpCount >= 1);
      assert.equal(summary.notebookCount, 31);
      assert.ok(summary.skeletonCount >= 1);
      assert.ok(summary.bytesWritten > 1000);

      assert.ok(fs.existsSync(tmpOut));
      const content = fs.readFileSync(tmpOut, 'utf8');
      assert.ok(content.includes('# Ecosystem Architecture Guide (Current)'));
      assert.ok(content.includes('## 6. Cross-Subsystem Architectural & Sequence Flow Diagrams'));
      assert.ok(content.includes('## 7. High-Gravity Architectural Contract Hubs (Trail AST Skeletons)'));
      assert.ok(content.includes('## 8. Authoritative Agent & CLI Invariant Rules (Source of Truth)'));
    } finally {
      if (fs.existsSync(tmpOut)) {
        fs.unlinkSync(tmpOut);
      }
    }
  });

  it('generateAndWriteGuideAsync produces full output cleanly', async () => {
    const tmpOut = path.join(os.tmpdir(), `test-eco-guide-async-${Date.now()}.md`);
    try {
      const summary = await generateAndWriteGuideAsync(tmpOut, { noGemini: true });
      assert.equal(summary.outputPath, tmpOut);
      assert.ok(summary.skeletonCount >= 1);
      assert.equal(summary.notebookCount, 31);
      assert.ok(fs.existsSync(tmpOut));
    } finally {
      if (fs.existsSync(tmpOut)) {
        fs.unlinkSync(tmpOut);
      }
    }
  });
});
