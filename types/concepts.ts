import type { Id } from '@/convex/_generated/dataModel';

// ============================================================================
// FSRS Types (Shared between concepts and legacy questions)
// ============================================================================

export interface FsrsState {
  stability: number;
  difficulty: number;
  lastReview?: number;
  nextReview: number;
  elapsedDays?: number;
  retrievability?: number;
}

// ============================================================================
// IQC (Intelligent Quality Control) Types
// ============================================================================

export interface IqcScores {
  phrasingCount: number;
  conflictScore?: number; // Heuristic for "overloaded" concept
  thinScore?: number; // Heuristic for "needs more phrasings"
  qualityScore?: number; // Overall quality signal
}

// ============================================================================
// Concept Types (Matching Convex schema)
// ============================================================================

export interface ConceptDoc {
  _id: Id<'concepts'>;
  _creationTime: number;
  userId: Id<'users'>;
  title: string;
  description?: string;

  // FSRS state (single source of truth for scheduling)
  fsrs: FsrsState;

  // IQC signals
  phrasingCount: number;
  conflictScore?: number;
  thinScore?: number;
  qualityScore?: number;

  // Vector embeddings
  embedding?: number[];
  embeddingGeneratedAt?: number;

  // Timestamps
  createdAt: number;
  updatedAt?: number;
}

// ============================================================================
// Phrasing Types (Matching Convex schema)
// ============================================================================

export type PhrasingType = 'multiple-choice' | 'true-false' | 'cloze' | 'short-answer';

export interface PhrasingDoc {
  _id: Id<'phrasings'>;
  _creationTime: number;
  userId: Id<'users'>;
  conceptId: Id<'concepts'>;

  // Question content
  question: string;
  explanation?: string;
  type?: PhrasingType;
  options?: string[];
  correctAnswer?: string;

  // Local attempt statistics (analytics only, not scheduling)
  attemptCount?: number;
  correctCount?: number;
  lastAttemptedAt?: number;

  // Soft delete and update tracking
  createdAt: number;
  updatedAt?: number;
  archivedAt?: number;
  deletedAt?: number;

  // Vector embeddings
  embedding?: number[];
  embeddingGeneratedAt?: number;
}

// ============================================================================
// Action Card Types (IQC Proposals)
// ============================================================================

export type ActionCardKind =
  | 'MERGE_CONCEPTS'
  | 'SPLIT_CONCEPT'
  | 'ASSIGN_ORPHANS'
  | 'FILL_OUT_CONCEPT'
  | 'RENAME_CONCEPT';

export interface ActionCardDoc {
  _id: Id<'actionCards'>;
  _creationTime: number;
  userId: Id<'users'>;
  kind: ActionCardKind;
  payload: unknown; // Concrete proposal (concept IDs, reason strings, preview diffs)

  // Lifecycle
  createdAt: number;
  expiresAt?: number;
  resolvedAt?: number;
  resolution?: 'accepted' | 'rejected';
}

// ============================================================================
// Reclustering Job Types
// ============================================================================

export type ReclusterJobStatus = 'queued' | 'running' | 'done' | 'failed';

export interface ReclusterJobDoc {
  _id: Id<'reclusterJobs'>;
  _creationTime: number;
  userId: Id<'users'>;
  status: ReclusterJobStatus;
  createdAt: number;
  completedAt?: number;
  stats?: unknown; // Job statistics (concepts processed, proposals created, etc.)
}
