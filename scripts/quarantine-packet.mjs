import * as fs from 'fs';
import * as path from 'path';

/**
 * scripts/quarantine-packet.mjs
 * Generates an incident snapshot into wiki/lessons/ for quarantined packets.
 */
const args = process.argv.slice(2);
const packetArg = args.find(arg => arg.startsWith('--packet-id='));
const reasonArg = args.find(arg => arg.startsWith('--reason='));

const packetId = packetArg ? packetArg.split('=')[1] : 'unknown-packet';
const reason = reasonArg ? reasonArg.split('=')[1] : 'INTEGRATION_IRON_GATE_FAILURE';

const timestamp = new Date().toISOString();
const dateStr = timestamp.split('T')[0];
const targetDir = path.resolve(process.cwd(), 'wiki/lessons');
fs.mkdirSync(targetDir, { recursive: true });

const safePacketId = packetId.replace(/[^a-zA-Z0-9-_]/g, '_');
const filename = `${dateStr}-quarantine-${safePacketId}.md`;
const filePath = path.join(targetDir, filename);

const lessonContent = `---
title: "Quarantine Incident: Strike Packet ${packetId}"
category: "lessons"
status: "active"
tags: ["incident", "tripwire", "quarantine", "needs-enrichment"]
packet_id: "${packetId}"
tripped_reason: "${reason}"
timestamp: "${timestamp}"
---

### Quarantine Incident: Strike Packet ${packetId}

#### 1. Context & Symptom
* **Target Subsystem / Packet:** \`${packetId}\`
* **Error Signature / Reason:** \`${reason}\`
* **First Identified:** ${dateStr} via Serial Merge Queue

#### 2. Root Cause Analysis
Diagnostic Log captured from serial merge queue failure. Detailed root cause pending background LLM enrichment pass.

#### 3. Resolution & Prevention
Programmatic fix pending background LLM enrichment pass.

#### 4. Source Citations
* **Staged Snapshot:** \`.worktrees/${packetId}\`
* **Diagnostic Reference:** [[kb-sync/wiki/concepts/deterministic-sync-pipeline]]
`;

fs.writeFileSync(filePath, lessonContent, 'utf8');
console.log(`[Quarantine] Incident lesson created: ${filePath}`);
