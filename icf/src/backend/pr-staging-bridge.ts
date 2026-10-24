import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

export interface ActionCard {
  id: string;
  title?: string;
  intent?: string;
  target?: string;
  category?: string;
  direction?: string;
  priority?: string;
  status?: string;
  deliverables?: string[] | string;
  context?: Record<string, unknown>;
  raw_content?: string;
  body?: string;
  filePath?: string;
  _filePath?: string;
  [key: string]: unknown;
}
export const ActionCard = {};

export interface GitHubClient {
  createPullRequest(params: {
    repo: string;
    title: string;
    body: string;
    head: string;
    base?: string;
  }): Promise<{ number: number; html_url: string; [key: string]: unknown }>;
}
export const GitHubClient = {};

export interface BatchPromotionOptions {
  cardIds?: string[];
  cards?: ActionCard[];
  targetRepo?: string;
  repoPath?: string;
  reposRoot?: string;
  pendingDir?: string;
  branchName?: string;
  date?: string;
  prTitle?: string;
  baseBranch?: string;
  githubClient?: GitHubClient;
  lockRegistry?: CardLockRegistry;
}
export const BatchPromotionOptions = {};

export interface BatchPromotionResult {
  status: 'SUCCESS' | 'ERROR' | 'LOCK_HELD';
  branchName: string;
  prNumber?: number;
  prUrl?: string;
  prBody: string;
  promotedCards: ActionCard[];
  error?: string;
}
export const BatchPromotionResult = {};

export class LockHeldError extends Error {
  readonly code = 'LOCK_HELD';
  constructor(message = 'LOCK_HELD') {
    super(message);
    this.name = 'LockHeldError';
  }
}

export class CardLockRegistry {
  locked: Set<string> = new Set<string>();

  acquire(cardIds: string[]): void {
    for (const id of cardIds) {
      if (this.locked.has(id)) {
        throw new LockHeldError(`LOCK_HELD: card ${id} is already locked`);
      }
    }
    for (const id of cardIds) {
      this.locked.add(id);
    }
  }

  release(cardIds: string[]): void {
    for (const id of cardIds) {
      this.locked.delete(id);
    }
  }

  isLocked(cardId: string): boolean {
    return this.locked.has(cardId);
  }

  clear(): void {
    this.locked.clear();
  }
}

export const defaultLockRegistry = new CardLockRegistry();

export class LiveGitHubClient implements GitHubClient {
  async createPullRequest(params: {
    repo: string;
    title: string;
    body: string;
    head: string;
    base?: string;
  }): Promise<{ number: number; html_url: string; [key: string]: unknown }> {
    const base = params.base || 'main';
    const output = execFileSync(
      'gh',
      ['pr', 'create', '--repo', params.repo, '--title', params.title, '--body', params.body, '--head', params.head, '--base', base],
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
    );
    const url = output.trim();
    const match = url.match(/\/pull\/(\d+)/);
    return {
      number: match ? parseInt(match[1], 10) : 1,
      html_url: url
    };
  }
}

export function normalizeDeliverables(deliverables?: string[] | string): string[] {
  if (!deliverables) return [];
  if (Array.isArray(deliverables)) {
    return deliverables
      .map(d => String(d).replace(/^[-*]\s*(\[[ xX]\]\s*)?/, '').trim())
      .filter(Boolean);
  }
  return String(deliverables)
    .split(/\r?\n/)
    .map(line => line.replace(/^[-*]\s*(\[[ xX]\]\s*)?/, '').trim())
    .filter(Boolean);
}

export function formatConsolidatedPrBody(cards: ActionCard[], branchName?: string): string {
  const lines: string[] = ['## TRM Batch Triage Consolidated PR'];
  if (branchName) {
    lines.push(`**Target Branch**: \`${branchName}\``);
  }
  lines.push(`**Included Action Cards**: ${cards.length}\n`);

  for (const [index, card] of cards.entries()) {
    const cardId = card.id || `card-${index + 1}`;
    const title = card.title || card.intent || cardId;
    const intent = card.intent || card.title || 'N/A';
    const target = card.target || 'toolforge';

    lines.push(`### ${index + 1}. ${title} (\`${cardId}\`)`);
    lines.push(`- **Target**: \`${target}\``);
    lines.push(`- **Intent**: ${intent}`);
    lines.push(`- **Deliverables Checklist**:`);

    const deliverables = normalizeDeliverables(card.deliverables);
    if (deliverables.length === 0) {
      lines.push(`  - [ ] Implementation and verification`);
    } else {
      for (const d of deliverables) {
        lines.push(`  - [ ] ${d}`);
      }
    }
    lines.push('');
  }

  return lines.join('\n').trim();
}

function parseCardMarkdown(cardId: string, fullPath: string): ActionCard {
  const content = fs.readFileSync(fullPath, 'utf8');
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const card: ActionCard = { id: cardId, filePath: fullPath };
  if (match) {
    for (const line of match[1].split(/\r?\n/)) {
      const idx = line.indexOf(':');
      if (idx > 0) {
        const key = line.slice(0, idx).trim();
        const value = line.slice(idx + 1).trim();
        card[key] = value;
      }
    }
    card.body = content.slice(match[0].length).trim();
  } else {
    card.body = content;
  }
  return card;
}

export function loadCardFromPending(cardId: string, pendingDir: string): ActionCard {
  const directJson = path.join(pendingDir, `${cardId}.json`);
  if (fs.existsSync(directJson)) {
    const data = JSON.parse(fs.readFileSync(directJson, 'utf8')) as ActionCard;
    data.id = data.id || cardId;
    data.filePath = directJson;
    return data;
  }

  const directMd = path.join(pendingDir, `${cardId}.md`);
  if (fs.existsSync(directMd)) {
    return parseCardMarkdown(cardId, directMd);
  }

  if (fs.existsSync(pendingDir)) {
    const files = fs.readdirSync(pendingDir);
    for (const file of files) {
      if (file.includes(cardId)) {
        const fullPath = path.join(pendingDir, file);
        if (file.endsWith('.json')) {
          const data = JSON.parse(fs.readFileSync(fullPath, 'utf8')) as ActionCard;
          data.id = data.id || cardId;
          data.filePath = fullPath;
          return data;
        }
        if (file.endsWith('.md')) {
          return parseCardMarkdown(cardId, fullPath);
        }
      }
    }
  }

  throw new Error(`Card ${cardId} not found in pending directory: ${pendingDir}`);
}

function resolveRepoPath(target: string, options: BatchPromotionOptions): string {
  if (options.repoPath) {
    return options.repoPath;
  }
  if (options.reposRoot) {
    const candidate = path.join(options.reposRoot, target);
    if (fs.existsSync(candidate)) return candidate;
  }
  const localCandidate = path.resolve(process.cwd(), target);
  if (fs.existsSync(localCandidate)) return localCandidate;
  return process.cwd();
}

function formatIsoDateCompact(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

export async function promoteBatch(options: BatchPromotionOptions): Promise<BatchPromotionResult> {
  const lockRegistry = options.lockRegistry || defaultLockRegistry;

  const cards: ActionCard[] = [];
  if (options.cards && options.cards.length > 0) {
    cards.push(...options.cards);
  } else if (options.cardIds && options.cardIds.length > 0) {
    const pendingDir = options.pendingDir || path.resolve(process.cwd(), '.harness/tasks/pending');
    for (const id of options.cardIds) {
      cards.push(loadCardFromPending(id, pendingDir));
    }
  } else {
    throw new Error('No action cards provided for batch promotion');
  }

  const cardIds = cards.map(c => c.id);
  lockRegistry.acquire(cardIds);

  const target = options.targetRepo || cards[0]?.target || 'toolforge';
  const repoPath = resolveRepoPath(target, options);
  const dateStr = options.date || formatIsoDateCompact(new Date());
  const branchName = options.branchName || `batch/trm-${dateStr}-triage`;
  const prBody = formatConsolidatedPrBody(cards, branchName);
  const prTitle = options.prTitle || `batch(trm): ${branchName} triage promotion`;

  let branchCreated = false;

  try {
    if (fs.existsSync(path.join(repoPath, '.git'))) {
      execFileSync('git', ['branch', branchName], { cwd: repoPath, stdio: 'pipe' });
      branchCreated = true;
    }

    const ghClient = options.githubClient || new LiveGitHubClient();
    const prResult = await ghClient.createPullRequest({
      repo: target,
      title: prTitle,
      body: prBody,
      head: branchName,
      base: options.baseBranch || 'main'
    });

    return {
      status: 'SUCCESS',
      branchName,
      prNumber: prResult.number,
      prUrl: prResult.html_url,
      prBody,
      promotedCards: cards
    };
  } catch (err) {
    if (branchCreated) {
      try {
        execFileSync('git', ['branch', '-D', branchName], { cwd: repoPath, stdio: 'pipe' });
      } catch {
        // Safe to ignore if already absent
      }
    }
    throw err;
  } finally {
    lockRegistry.release(cardIds);
  }
}

export class PrStagingBridge {
  options: Partial<BatchPromotionOptions>;
  lockRegistry: CardLockRegistry;

  constructor(
    options: Partial<BatchPromotionOptions> = {},
    lockRegistry: CardLockRegistry = defaultLockRegistry
  ) {
    this.options = options;
    this.lockRegistry = lockRegistry;
  }

  promoteBatch(options: BatchPromotionOptions): Promise<BatchPromotionResult> {
    return promoteBatch({ ...this.options, ...options, lockRegistry: this.lockRegistry });
  }

  formatConsolidatedPrBody(cards: ActionCard[], branchName?: string): string {
    return formatConsolidatedPrBody(cards, branchName);
  }
}

export default PrStagingBridge;
