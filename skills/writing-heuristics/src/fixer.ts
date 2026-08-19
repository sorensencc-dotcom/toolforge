import * as fs from 'fs';
import * as path from 'path';
import { FixFileResult, FixOptions, FixResult, Violation } from './types';
import { lintText } from './linter';

export function toSentenceCase(headingText: string): string {
  const words = headingText.split(/(\s+)/);
  return words
    .map((w, index) => {
      // Preserve first word capitalization, whitespace, acronyms (API, CLI, HTTP), or code
      if (index === 0 || /\s+/.test(w) || /^[A-Z0-9_]{2,}$/.test(w) || /^`.*`$/.test(w)) {
        return w;
      }
      return w.toLowerCase();
    })
    .join('');
}

export function applyFixes(content: string, violations: Violation[]): FixResult {
  const eol = content.includes('\r\n') ? '\r\n' : '\n';
  const hasBom = content.charCodeAt(0) === 0xfeff;
  let text = hasBom ? content.slice(1) : content;

  let appliedCount = 0;
  const lines = text.split(/\r?\n/);

  for (const v of violations) {
    if (!v.autofix || v.confidence < 0.95) {
      continue;
    }

    const lineIdx = v.line - 1;
    if (lineIdx < 0 || lineIdx >= lines.length) continue;
    const line = lines[lineIdx];

    // Fix ban-throat-clearing
    if (v.ruleId === 'ban-throat-clearing') {
      const regex = /^(Certainly|Sure thing|Sure|Here is|In this section|Let's dive|Note that|Allow me to|Of course)[!,.:]?\s*/i;
      const newLine = line.replace(regex, '');
      if (newLine !== line) {
        lines[lineIdx] = newLine.charAt(0).toUpperCase() + newLine.slice(1);
        appliedCount++;
      }
    }

    // Fix heading-sentence-case
    if (v.ruleId === 'heading-sentence-case') {
      const match = line.match(/^(#{1,6}\s+)(.*)$/);
      if (match) {
        lines[lineIdx] = match[1] + toSentenceCase(match[2]);
        appliedCount++;
      }
    }
  }

  let fixedContent = lines.join(eol);
  if (hasBom) {
    fixedContent = '\uFEFF' + fixedContent;
  }

  return {
    originalContent: content,
    fixedContent,
    appliedCount,
    clean: appliedCount > 0,
  };
}

export async function safeFixFile(filePath: string, options: FixOptions = {}): Promise<FixFileResult> {
  const content = fs.readFileSync(filePath, 'utf8');
  const lintRes = lintText(content, { filePath });
  const fixRes = applyFixes(content, lintRes.violations);

  if (options.dryRun || fixRes.appliedCount === 0) {
    return {
      ...fixRes,
      filePath,
    };
  }

  const pid = process.pid;
  const timestamp = Date.now();
  const dir = path.dirname(filePath);
  const ext = path.extname(filePath);
  const base = path.basename(filePath, ext);

  const tmpPath = path.join(dir, `${base}.${pid}.${timestamp}.tmp`);
  let backupPath: string | undefined;

  if (!options.noBackup) {
    let bakSuffix = '';
    let counter = 0;
    while (fs.existsSync(path.join(dir, `${base}.${timestamp}.bak${bakSuffix}`))) {
      counter++;
      bakSuffix = `.${counter}`;
    }
    backupPath = path.join(dir, `${base}.${timestamp}.bak${bakSuffix}`);
  }

  try {
    const fd = fs.openSync(tmpPath, 'w');
    fs.writeFileSync(fd, fixRes.fixedContent, 'utf8');
    fs.fsyncSync(fd);
    fs.closeSync(fd);

    if (backupPath) {
      fs.copyFileSync(filePath, backupPath);
    }

    fs.copyFileSync(tmpPath, filePath);

    return {
      ...fixRes,
      filePath,
      backupPath,
    };
  } catch (err) {
    if (backupPath && fs.existsSync(backupPath)) {
      try {
        fs.copyFileSync(backupPath, filePath);
      } catch (_) {}
    }
    throw err;
  } finally {
    if (fs.existsSync(tmpPath)) {
      try {
        fs.unlinkSync(tmpPath);
      } catch (_) {}
    }
  }
}
