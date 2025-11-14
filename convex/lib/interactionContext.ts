import type { Doc } from '../_generated/dataModel';

type InteractionContext = Doc<'interactions'>['context'];

type FsrsState = 'new' | 'learning' | 'review' | 'relearning';

interface BuildInteractionContextOptions {
  sessionId?: string | null;
  scheduledDays?: number | null;
  nextReview?: number | null;
  fsrsState?: FsrsState | null;
  isRetry?: boolean;
}

/**
 * Create a compact interaction context payload.
 * Only includes keys that contain meaningful values to minimize bandwidth.
 */
export function buildInteractionContext(
  options: BuildInteractionContextOptions
): InteractionContext {
  const context: Record<string, unknown> = {};

  if (options.sessionId) {
    context.sessionId = options.sessionId;
  }

  if (typeof options.isRetry === 'boolean') {
    context.isRetry = options.isRetry;
  }

  if (typeof options.scheduledDays === 'number') {
    context.scheduledDays = options.scheduledDays;
  }

  if (typeof options.nextReview === 'number') {
    context.nextReview = options.nextReview;
  }

  if (options.fsrsState) {
    context.fsrsState = options.fsrsState;
  }

  return Object.keys(context).length > 0 ? (context as InteractionContext) : undefined;
}
