import type { Doc, Id } from '../_generated/dataModel';

export type PhrasingDoc = Doc<'phrasings'>;
export type SelectionReason = 'canonical' | 'least-seen' | 'random' | 'none';

export interface SelectionPolicyOptions {
  canonicalPhrasingId?: Id<'phrasings'>;
  excludePhrasingId?: Id<'phrasings'>;
  preferLeastSeen?: boolean;
  random?: () => number;
}

export interface SelectionDecision {
  phrasing: PhrasingDoc | null;
  reason: SelectionReason;
}

export function selectPhrasingForConcept(
  phrasings: PhrasingDoc[],
  options: SelectionPolicyOptions = {}
): SelectionDecision {
  const activePhrasings = phrasings.filter((phrasing) => {
    if (phrasing.deletedAt || phrasing.archivedAt) {
      return false;
    }
    if (options.excludePhrasingId && phrasing._id === options.excludePhrasingId) {
      return false;
    }

    return true;
  });

  if (activePhrasings.length === 0) {
    return { phrasing: null, reason: 'none' };
  }

  if (options.canonicalPhrasingId) {
    const canonical = activePhrasings.find((p) => p._id === options.canonicalPhrasingId);
    if (canonical) {
      return { phrasing: canonical, reason: 'canonical' };
    }
  }

  if (options.preferLeastSeen !== false) {
    const sorted = [...activePhrasings].sort((a, b) => {
      const attemptDiff = (a.attemptCount ?? 0) - (b.attemptCount ?? 0);
      if (attemptDiff !== 0) {
        return attemptDiff;
      }

      const lastAttemptDiff = (a.lastAttemptedAt ?? 0) - (b.lastAttemptedAt ?? 0);
      if (lastAttemptDiff !== 0) {
        return lastAttemptDiff;
      }

      return a._creationTime - b._creationTime;
    });

    if (sorted.length > 0) {
      return { phrasing: sorted[0], reason: 'least-seen' };
    }
  }

  const randomFn = options.random ?? Math.random;
  const randomIndex = Math.floor(randomFn() * activePhrasings.length);

  return {
    phrasing: activePhrasings[randomIndex],
    reason: 'random',
  };
}
