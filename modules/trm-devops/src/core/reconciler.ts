import fs from "fs";
import path from "path";
import type {
  DefectItem,
  DefectStatus,
  BlastRadiusRating,
  FailingWorkflow,
  StructuredOperatorNotes
} from "./types.ts";
import { FileLock } from "./lock.ts";

export function renderQueueMarkdown(items: DefectItem[], syncDate: Date = new Date()): string {
  let md = `# Dev Triage Queue\n*Last Synced: ${syncDate.toISOString()}*\n\n## Active Defects\n\n`;

  for (const item of items) {
    md += `### [${item.id}] ${item.title}\n`;
    md += `- **Status:** ${item.status}\n`;
    if (item.triageOwner) {
      md += `- **Owner:** ${item.triageOwner}\n`;
    }
    if (item.tags && item.tags.length > 0) {
      md += `- **Tags:** ${item.tags.map((t) => `\`${t}\``).join(", ")}\n`;
    }
    md += `- **Target Repo:** \`${item.targetRepo || "UNKNOWN"}\`\n`;

    if (item.failingWorkflows && item.failingWorkflows.length > 0) {
      md += `- **Failing Workflows:**\n`;
      for (const w of item.failingWorkflows) {
        const parts: string[] = [];
        if (w.commitSha) parts.push(`SHA: \`${w.commitSha}\``);
        if (w.runId) parts.push(`Run ID: \`${w.runId}\``);
        if (w.job) parts.push(`Job: \`${w.job}\``);
        if (w.step) parts.push(`Step: \`${w.step}\``);
        if (w.runner) parts.push(`Runner: \`${w.runner}\``);
        if (w.attempt !== undefined) parts.push(`Attempt: \`${w.attempt}\``);
        const details = parts.length > 0 ? ` (${parts.join(", ")})` : "";
        md += `  - \`${w.name}\`${details}\n`;
      }
    }

    md += `- **Blast Radius:** ${item.blastRadius || "P2"}\n`;
    md += `- **NotebookLM Source ID:** \`${item.sourceId || "LOCAL"}\`\n`;
    md += `- **Source Fingerprint:** \`${item.sourceFingerprint || ""}\`\n`;
    md += `- **Signature Hash:** \`${item.signatureHash}\`\n`;
    md += `- **Parent Hash:** \`${item.parentHash || "NONE"}\`\n`;
    md += `- **First Seen:** ${item.firstSeen || new Date().toISOString()}\n`;
    md += `- **Last Observed:** ${item.lastObserved || new Date().toISOString()}\n`;
    if (item.lastAction) {
      md += `- **Last Action:** ${item.lastAction}\n`;
    }

    if (item.primarySuspects && item.primarySuspects.length > 0) {
      md += `- **Primary Suspects:**\n`;
      for (const s of item.primarySuspects) {
        md += `  - ${s}\n`;
      }
    }

    if (item.actionSteps && item.actionSteps.length > 0) {
      md += `- **Deterministic Action Steps:**\n`;
      item.actionSteps.forEach((step, idx) => {
        const formatted = step.startsWith("`") && step.endsWith("`") ? step : `\`${step}\``;
        md += `  ${idx + 1}. ${formatted}\n`;
      });
    }

    md += `<!-- operator-notes-start -->\n`;
    if (item.operatorNotes) {
      if (item.operatorNotes.context) {
        md += `[context]: ${item.operatorNotes.context}\n`;
      }
      if (item.operatorNotes.attemptedFixes && item.operatorNotes.attemptedFixes.length > 0) {
        for (const fix of item.operatorNotes.attemptedFixes) {
          md += `[attempted-fixes]: ${fix}\n`;
        }
      }
      if (item.operatorNotes.blockedOn) {
        md += `[blocked-on]: ${item.operatorNotes.blockedOn}\n`;
      }
      if (item.operatorNotes.rawText) {
        md += `${item.operatorNotes.rawText}\n`;
      }
    }
    md += `<!-- operator-notes-end -->\n\n`;
  }

  return md;
}

export function parseQueueMarkdown(markdown: string): DefectItem[] {
  const items: DefectItem[] = [];
  const sections = markdown.split(/\n(?=### \[(?:DEV-\d+|[A-Z0-9_-]+)\])/g);

  for (const sec of sections) {
    const titleMatch = sec.match(/^### \[(DEV-\d+|[A-Z0-9_-]+)\] (.+)/m);
    if (!titleMatch) continue;

    const id = titleMatch[1];
    const title = titleMatch[2].trim();

    const hashMatch = sec.match(/^[ \t]*- \*\*Signature Hash:\*\*\s*`([^`]+)`/m);
    if (!hashMatch) continue;
    const signatureHash = hashMatch[1];

    const statusMatch = sec.match(/^[ \t]*- \*\*Status:\*\*\s*(\w+)/m);
    const ownerMatch = sec.match(/^[ \t]*- \*\*Owner:\*\*\s*(.+)/m);
    const tagsMatch = sec.match(/^[ \t]*- \*\*Tags:\*\*\s*(.+)/m);
    const repoMatch = sec.match(/^[ \t]*- \*\*Target Repo:\*\*\s*`([^`]+)`/m);
    const blastMatch = sec.match(/^[ \t]*- \*\*Blast Radius:\*\*\s*(P\d)/m);
    const srcIdMatch = sec.match(/^[ \t]*- \*\*NotebookLM Source ID:\*\*\s*`([^`]+)`/m);
    const srcFpMatch = sec.match(/^[ \t]*- \*\*Source Fingerprint:\*\*\s*`([^`]+)`/m);
    const parentMatch = sec.match(/^[ \t]*- \*\*Parent Hash:\*\*\s*`([^`]+)`/m);
    const firstSeenMatch = sec.match(/^[ \t]*- \*\*First Seen:\*\*\s*(.+)/m);
    const lastObsMatch = sec.match(/^[ \t]*- \*\*Last Observed:\*\*\s*(.+)/m);
    const lastActionMatch = sec.match(/^[ \t]*- \*\*Last Action:\*\*\s*(.+)/m);

    const status = (statusMatch ? statusMatch[1] : "OPEN") as DefectStatus;
    const triageOwner = ownerMatch ? ownerMatch[1].trim() : undefined;

    const tags: string[] = [];
    if (tagsMatch) {
      const matches = Array.from(tagsMatch[1].matchAll(/`([^`]+)`/g)).map((m) => m[1]);
      if (matches.length > 0) {
        tags.push(...matches);
      } else {
        tags.push(...tagsMatch[1].split(",").map((t) => t.trim()).filter(Boolean));
      }
    }

    const targetRepo = repoMatch ? repoMatch[1] : "UNKNOWN";
    const blastRadius = (blastMatch ? blastMatch[1] : "P2") as BlastRadiusRating;
    const sourceId = srcIdMatch ? srcIdMatch[1] : "LOCAL";
    const sourceFingerprint = srcFpMatch ? srcFpMatch[1] : "";
    const parentHash = parentMatch && parentMatch[1] !== "NONE" ? parentMatch[1] : undefined;
    const firstSeen = firstSeenMatch ? firstSeenMatch[1].trim() : new Date().toISOString();
    const lastObserved = lastObsMatch ? lastObsMatch[1].trim() : new Date().toISOString();
    const lastAction = lastActionMatch ? lastActionMatch[1].trim() : undefined;

    // Parse failing workflows
    const failingWorkflows: FailingWorkflow[] = [];
    const wfBlockMatch = sec.match(/- \*\*Failing Workflows:\*\*\n((?:[ ]{2,4}- .*\n?)*)/);
    if (wfBlockMatch) {
      const lines = wfBlockMatch[1].split("\n").map((l) => l.trim()).filter((l) => l.startsWith("- "));
      for (const line of lines) {
        const nameMatch = line.match(/^-\s*`([^`]+)`(?:\s*\((.*)\))?/);
        if (nameMatch) {
          const name = nameMatch[1];
          const details = nameMatch[2] || "";
          const shaMatch = details.match(/SHA:\s*`([^`]+)`/i);
          const runIdMatch = details.match(/Run ID:\s*`([^`]+)`/i);
          const jobMatch = details.match(/Job:\s*`([^`]+)`/i);
          const stepMatch = details.match(/Step:\s*`([^`]+)`/i);
          const runnerMatch = details.match(/Runner:\s*`([^`]+)`/i);
          const attemptMatch = details.match(/Attempt:\s*`?(\d+)`?/i);

          failingWorkflows.push({
            name,
            commitSha: shaMatch ? shaMatch[1] : "HEAD",
            runId: runIdMatch ? runIdMatch[1] : undefined,
            job: jobMatch ? jobMatch[1] : undefined,
            step: stepMatch ? stepMatch[1] : undefined,
            runner: runnerMatch ? runnerMatch[1] : undefined,
            attempt: attemptMatch ? parseInt(attemptMatch[1], 10) : undefined
          });
        }
      }
    }

    // Parse primary suspects
    const primarySuspects: string[] = [];
    const suspectsBlockMatch = sec.match(/- \*\*Primary Suspects:\*\*\n((?:[ ]{2,4}- .*\n?)*)/);
    if (suspectsBlockMatch) {
      const lines = suspectsBlockMatch[1].split("\n").map((l) => l.trim()).filter((l) => l.startsWith("- "));
      for (const line of lines) {
        primarySuspects.push(line.replace(/^-\s*/, ""));
      }
    }

    // Parse action steps
    const actionSteps: string[] = [];
    const stepsBlockMatch = sec.match(/- \*\*Deterministic Action Steps:\*\*\n((?:[ ]{2,4}\d+\.\s+.*\n?)*)/);
    if (stepsBlockMatch) {
      const lines = stepsBlockMatch[1].split("\n").map((l) => l.trim()).filter((l) => /^\d+\.\s+/.test(l));
      for (const line of lines) {
        const stepText = line.replace(/^\d+\.\s+/, "");
        const codeMatch = stepText.match(/^`([^`]+)`$/);
        actionSteps.push(codeMatch ? codeMatch[1] : stepText);
      }
    }

    // Parse operator notes
    let operatorNotes: StructuredOperatorNotes | undefined = undefined;
    const notesBlockMatch = sec.match(/<!-- operator-notes-start -->([\s\S]*?)<!-- operator-notes-end -->/);
    if (notesBlockMatch && notesBlockMatch[1].trim()) {
      const raw = notesBlockMatch[1].trim();
      const contextMatch = raw.match(/\[context\]:\s*(.+)/);
      const blockedMatch = raw.match(/\[blocked-on\]:\s*(.+)/);
      const attempted = Array.from(raw.matchAll(/\[attempted-fixes\]:\s*(.+)/g)).map((m) => m[1].trim());

      if (contextMatch || blockedMatch || attempted.length > 0) {
        operatorNotes = {
          context: contextMatch ? contextMatch[1].trim() : undefined,
          attemptedFixes: attempted.length > 0 ? attempted : undefined,
          blockedOn: blockedMatch ? blockedMatch[1].trim() : undefined
        };
        const leftoverLines = raw
          .split("\n")
          .map((l) => l.trim())
          .filter(
            (l) =>
              l.length > 0 &&
              !l.startsWith("[context]:") &&
              !l.startsWith("[blocked-on]:") &&
              !l.startsWith("[attempted-fixes]:")
          );
        if (leftoverLines.length > 0) {
          operatorNotes.rawText = leftoverLines.join("\n");
        }
      } else {
        operatorNotes = { rawText: raw };
      }
    }

    items.push({
      id,
      title,
      signatureHash,
      status,
      targetRepo,
      blastRadius,
      sourceId,
      sourceFingerprint,
      parentHash,
      firstSeen,
      lastObserved,
      lastAction,
      triageOwner,
      tags,
      failingWorkflows,
      primarySuspects,
      actionSteps,
      operatorNotes
    });
  }

  return items;
}

export async function reconcileQueue(
  queuePath: string,
  incomingItems: DefectItem[],
  syncDate?: Date
): Promise<DefectItem[]> {
  const lock = new FileLock(queuePath);
  await lock.acquire();

  try {
    let existing: DefectItem[] = [];
    let parsedSyncDate: Date | undefined = undefined;

    if (fs.existsSync(queuePath)) {
      const existingContent = fs.readFileSync(queuePath, "utf8");
      existing = parseQueueMarkdown(existingContent);
      const syncDateMatch = existingContent.match(/^\*Last Synced:\s*(.+)\*/m);
      if (syncDateMatch) {
        const d = new Date(syncDateMatch[1].trim());
        if (!isNaN(d.getTime())) {
          parsedSyncDate = d;
        }
      }
    }

    let maxSeq = 0;
    const existingByHash = new Map<string, DefectItem>();

    for (const item of existing) {
      const match = item.id.match(/^DEV-(\d+)$/);
      if (match) {
        maxSeq = Math.max(maxSeq, parseInt(match[1], 10));
      }
      existingByHash.set(item.signatureHash, item);
    }

    let hasChanges = false;
    const merged: DefectItem[] = [];

    // Update existing items if fresh data arrives
    for (const item of existing) {
      const fresh = incomingItems.find((inc) => inc.signatureHash === item.signatureHash);
      if (fresh) {
        if (fresh.lastObserved && fresh.lastObserved !== item.lastObserved) {
          item.lastObserved = fresh.lastObserved;
          hasChanges = true;
        }
        if (fresh.failingWorkflows && fresh.failingWorkflows.length > 0) {
          const freshWfStr = JSON.stringify(fresh.failingWorkflows);
          const itemWfStr = JSON.stringify(item.failingWorkflows);
          if (freshWfStr !== itemWfStr) {
            item.failingWorkflows = fresh.failingWorkflows;
            hasChanges = true;
          }
        }
        if (fresh.sourceFingerprint && fresh.sourceFingerprint !== item.sourceFingerprint) {
          item.sourceFingerprint = fresh.sourceFingerprint;
          hasChanges = true;
        }
        if (fresh.sourceId && fresh.sourceId !== "LOCAL" && fresh.sourceId !== item.sourceId) {
          item.sourceId = fresh.sourceId;
          hasChanges = true;
        }
      }
      merged.push(item);
    }

    // Append novel incoming items
    for (const inc of incomingItems) {
      if (!existingByHash.has(inc.signatureHash)) {
        maxSeq++;
        const id = `DEV-${String(maxSeq).padStart(3, "0")}`;
        const newItem: DefectItem = {
          ...inc,
          id
        };
        existingByHash.set(inc.signatureHash, newItem);
        merged.push(newItem);
        hasChanges = true;
      }
    }

    const finalSyncDate = syncDate || (hasChanges || !parsedSyncDate ? new Date() : parsedSyncDate);

    const queueDir = path.dirname(queuePath);
    if (!fs.existsSync(queueDir)) {
      fs.mkdirSync(queueDir, { recursive: true });
    }

    const rendered = renderQueueMarkdown(merged, finalSyncDate);
    const tmpPath = `${queuePath}.tmp`;
    fs.writeFileSync(tmpPath, rendered, "utf8");
    fs.renameSync(tmpPath, queuePath);

    return merged;
  } finally {
    lock.release();
  }
}
