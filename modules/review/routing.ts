import type { LocalProviderLike } from '../../src/providers/index.js';
import { createAnthropicProvider } from './anthropic-provider.ts';
import { createOpenAIProvider } from './openai-provider.ts';
import type { ReviewerHttpDeps } from './provider-http.ts';

export type ReviewerProviderName = 'openai' | 'anthropic';

export interface ReviewerRoute {
  readonly provider: ReviewerProviderName;
  readonly model: string;
}

export interface ReviewerMatrixEntry {
  readonly authorPrefix: string;
  readonly reviewer: ReviewerRoute;
}

/** Entries match in table order, and the first case-insensitive author prefix match wins. */
export type ReviewerMatrix = readonly ReviewerMatrixEntry[];

export const DEFAULT_REVIEWER_MATRIX: ReviewerMatrix = [
  { authorPrefix: 'claude-', reviewer: { provider: 'openai', model: 'gpt-6.1-sol' } },
  { authorPrefix: 'gpt-', reviewer: { provider: 'anthropic', model: 'claude-opus-5-5' } },
];

export interface ReviewPacket {
  readonly author_model?: string;
  readonly commitMessage?: string;
  /** One entry per commit under review. Every commit's final trailer block counts. */
  readonly commitMessages?: readonly string[];
}

export class ReviewRoutingError extends Error {
  override name = 'ReviewRoutingError';
}

const CO_AUTHOR_LINE = /^[ \t]*co-authored-by:[ \t]*([^\s<][^<\n]*)<[^>\s]+>[ \t]*$/i;
const TRAILER_LINE = /^[A-Za-z][\w-]*:[ \t]/;

interface Author {
  readonly model: string;
  readonly source: string;
}

export function selectReviewer(packet: ReviewPacket, matrix: ReviewerMatrix = DEFAULT_REVIEWER_MATRIX): ReviewerRoute {
  if (matrix.some(({ authorPrefix }) => authorPrefix.trim() === '')) {
    throw new ReviewRoutingError('Reviewer matrix has an empty author prefix, which would match every author.');
  }
  const authors = resolveAuthors(packet);
  if (authors.length === 0) {
    throw new ReviewRoutingError(
      'No author_model for adversarial review. Set author_model on the packet or add a "Co-Authored-By: <model name> <email>" trailer.',
    );
  }
  const routes = new Map<string, ReviewerRoute>();
  for (const author of authors) {
    const entry = matrix.find(({ authorPrefix }) => author.model.startsWith(authorPrefix.toLowerCase()));
    if (entry === undefined) {
      const prefixes = matrix.map(({ authorPrefix }) => authorPrefix).join(', ');
      throw new ReviewRoutingError(
        `No reviewer for author_model "${author.model}" from ${author.source}. Known author prefixes: ${prefixes}.`,
      );
    }
    if (entry.reviewer.model.toLowerCase().startsWith(entry.authorPrefix.toLowerCase())) {
      throw new ReviewRoutingError(
        `Reviewer ${entry.reviewer.model} is in the same model family as author "${author.model}". Pick a reviewer from another family.`,
      );
    }
    routes.set(`${entry.reviewer.provider}/${entry.reviewer.model}`, entry.reviewer);
  }
  if (routes.size > 1) {
    const names = authors.map(({ model }) => model).join(', ');
    throw new ReviewRoutingError(`Conflicting author models (${names}) route to different reviewers. Review each author's changes separately.`);
  }
  return [...routes.values()][0];
}

export function resolveReviewerProvider(route: ReviewerRoute, deps: ReviewerHttpDeps = {}): LocalProviderLike {
  switch (route.provider) {
    case 'openai':
      return createOpenAIProvider(deps);
    case 'anthropic':
      return createAnthropicProvider(deps);
    default:
      throw new ReviewRoutingError(`Unsupported reviewer provider "${String((route as { provider: unknown }).provider)}".`);
  }
}

// A non-blank field is authoritative, so an unknown field value fails closed instead of falling back to a trailer.
function resolveAuthors({ author_model, commitMessage, commitMessages }: ReviewPacket): readonly Author[] {
  const field = toModelId(author_model ?? '');
  if (field !== '') return [{ model: field, source: 'the author_model field' }];
  const messages = [...(commitMessage === undefined ? [] : [commitMessage]), ...(commitMessages ?? [])];
  return messages.flatMap(finalTrailerNames).map((name) => ({ model: toModelId(name), source: 'a Co-Authored-By trailer' }));
}

// Only the last paragraph counts, and only when every line in it is a trailer, so a body example or a quoted trailer never routes.
function finalTrailerNames(message: string): string[] {
  const paragraphs = message.replace(/\r\n?/g, '\n').trimEnd().split(/\n[ \t]*\n/);
  if (paragraphs.length < 2) return [];
  const lines = paragraphs[paragraphs.length - 1].split('\n');
  if (!lines.every((line) => TRAILER_LINE.test(line))) return [];
  return lines.flatMap((line) => CO_AUTHOR_LINE.exec(line)?.[1] ?? []);
}

function toModelId(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, '-');
}
