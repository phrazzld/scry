import { describe, expect, it } from 'vitest';

import { api } from '@/convex/_generated/api';

/**
 * API Contract Tests
 *
 * These tests verify that all mutations and queries referenced in the frontend
 * actually exist in the backend. This prevents runtime errors from frontend-backend
 * contract mismatches.
 *
 * IMPORTANT: Update these tests when adding new features that require backend mutations.
 */

describe('API Contract: Library Mutations', () => {
  it('all required mutations exist', () => {
    // Archive operations (reversible pair)
    expect(api.questions.archiveQuestions).toBeDefined();
    expect(api.questions.unarchiveQuestions).toBeDefined();

    // Delete/Restore operations (reversible pair)
    expect(api.questions.bulkDelete).toBeDefined();
    expect(api.questions.restoreQuestions).toBeDefined();

    // Permanent delete (irreversible)
    expect(api.questions.permanentlyDelete).toBeDefined();
  });

  it('mutation pairs are symmetric', () => {
    // Archive ↔ Unarchive
    expect(api.questions.archiveQuestions).toBeDefined();
    expect(api.questions.unarchiveQuestions).toBeDefined();

    // Delete ↔ Restore
    expect(api.questions.bulkDelete).toBeDefined();
    expect(api.questions.restoreQuestions).toBeDefined();
  });

  it('library-client.tsx dependencies are satisfied', () => {
    // All mutations referenced in library-client.tsx must exist
    const requiredMutations = [
      'archiveQuestions',
      'unarchiveQuestions',
      'bulkDelete',
      'restoreQuestions',
      'permanentlyDelete',
    ] as const;

    requiredMutations.forEach((mutation) => {
      expect(api.questions[mutation]).toBeDefined();
    });
  });
});

describe('API Contract: Review Flow Mutations', () => {
  it('review-flow.tsx dependencies are satisfied', () => {
    // Mutations used in review-flow.tsx
    expect(api.questions.updateQuestion).toBeDefined();
    expect(api.questions.softDeleteQuestion).toBeDefined();
  });
});

describe('API Contract: Question Generation', () => {
  it('generation mutations and queries exist', () => {
    // Generation jobs
    expect(api.generationJobs.createJob).toBeDefined();
    expect(api.generationJobs.cancelJob).toBeDefined();
    expect(api.generationJobs.getRecentJobs).toBeDefined();
    expect(api.generationJobs.getJobById).toBeDefined();

    // Question queries
    expect(api.questions.getUserQuestions).toBeDefined();
    expect(api.questions.getLibrary).toBeDefined();
  });
});

describe('API Contract: Spaced Repetition', () => {
  it('spaced repetition mutations and queries exist', () => {
    // Review scheduling
    expect(api.spacedRepetition.getNextReview).toBeDefined();
    expect(api.spacedRepetition.getDueCount).toBeDefined();
    expect(api.spacedRepetition.scheduleReview).toBeDefined();
  });
});
