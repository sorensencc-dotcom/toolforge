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
}

export class ReviewRoutingError extends Error {
  override name = 'ReviewRoutingError';
}

// The name group runs greedily to the "<" and toModelId trims it, so no two quantifiers compete for the same spaces.
const CO_AUTHOR_TRAILER = /^[ \t]*co-authored-by:[ \t]*([^\s<][^<\n]*)<[^>\n]*>[ \t]*$/gim;

export function selectReviewer(packet: ReviewPacket, matrix: ReviewerMatrix = DEFAULT_REVIEWER_MATRIX): ReviewerRoute {
  const author = resolveAuthor(packet);
  if (author === undefined) {
    throw new ReviewRoutingError(
      'No author_model for adversarial review. Set author_model on the packet or add a "Co-Authored-By: <model name> <email>" trailer.',
    );
  }
  const entry = matrix.find(({ authorPrefix }) => author.model.startsWith(authorPrefix.toLowerCase()));
  if (entry === undefined) {
    const prefixes = matrix.map(({ authorPrefix }) => authorPrefix).join(', ');
    throw new ReviewRoutingError(
      `No reviewer for author_model "${author.model}" from ${author.source}. Known author prefixes: ${prefixes}.`,
    );
  }
  return entry.reviewer;
}

export function resolveReviewerProvider(route: ReviewerRoute, deps: ReviewerHttpDeps = {}): LocalProviderLike {
  switch (route.provider) {
    case 'openai':
      return createOpenAIProvider(deps);
    case 'anthropic':
      return createAnthropicProvider(deps);
  }
}

// A non-blank field is authoritative, so an unknown field value fails closed instead of falling back to a trailer.
function resolveAuthor({ author_model, commitMessage }: ReviewPacket): { model: string; source: string } | undefined {
  const field = toModelId(author_model ?? '');
  if (field !== '') return { model: field, source: 'the author_model field' };
  const name = [...(commitMessage ?? '').matchAll(CO_AUTHOR_TRAILER)].at(-1)?.[1];
  return name === undefined ? undefined : { model: toModelId(name), source: 'the last Co-Authored-By trailer' };
}

function toModelId(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, '-');
}
