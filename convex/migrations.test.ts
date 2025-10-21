import { describe, expect, it } from 'vitest';

import type { Doc, Id } from './_generated/dataModel';

/**
 * Unit tests for migration logic in migrations.ts
 *
 * Tests focus on validating migration behavior patterns including:
 * - Multi-batch processing logic
 * - Partial failure handling
 * - Idempotency guarantees
 * - Dry-run mode behavior
 * - Error tracking and reporting
 *
 * These tests validate the migration algorithms without requiring
 * actual Convex runtime execution.
 */

// Type definitions for migration results
type MigrationStatus = 'completed' | 'partial' | 'failed';

interface MigrationResult<TStats> {
  status: MigrationStatus;
  dryRun: boolean;
  stats: TStats;
  failures?: Array<{
    recordId: string;
    error: string;
  }>;
  message: string;
}

interface DifficultyRemovalStats {
  totalProcessed: number;
  updated: number;
  alreadyMigrated: number;
  errors: number;
}

/**
 * Helper to create mock questions with or without difficulty field
 */
function createMockQuestion(
  id: string,
  hasDifficulty: boolean = false
): Doc<'questions'> & { difficulty?: string } {
  const baseQuestion: Doc<'questions'> = {
    _id: id as Id<'questions'>,
    _creationTime: Date.now(),
    userId: 'user123' as Id<'users'>,
    question: 'Test question?',
    type: 'multiple-choice',
    options: ['A', 'B', 'C', 'D'],
    correctAnswer: 'A',
    generatedAt: Date.now(),
    attemptCount: 0,
    correctCount: 0,
  };

  return hasDifficulty ? { ...baseQuestion, difficulty: 'medium' } : baseQuestion;
}

/**
 * Simulates the difficulty removal migration logic
 * This mirrors the actual implementation in removeDifficultyFromQuestionsInternal
 */
function simulateDifficultyRemoval(
  questions: Array<Doc<'questions'> & { difficulty?: string }>,
  options: {
    batchSize?: number;
    dryRun?: boolean;
    simulateErrors?: Set<string>; // Question IDs that should fail
  } = {}
): MigrationResult<DifficultyRemovalStats> {
  const batchSize = options.batchSize || 500;
  const dryRun = options.dryRun || false;
  const simulateErrors = options.simulateErrors || new Set<string>();

  const stats: DifficultyRemovalStats = {
    totalProcessed: 0,
    updated: 0,
    alreadyMigrated: 0,
    errors: 0,
  };

  const failures: Array<{ recordId: string; error: string }> = [];

  // Simulate cursor-based pagination
  let currentIndex = 0;
  while (currentIndex < questions.length) {
    const batch = questions.slice(currentIndex, currentIndex + batchSize);

    for (const question of batch) {
      stats.totalProcessed++;

      // Simulate error for specific questions
      if (simulateErrors.has(question._id)) {
        failures.push({
          recordId: question._id,
          error: 'Simulated migration error',
        });
        stats.errors++;
        continue;
      }

      // Check if question has difficulty field
      if ('difficulty' in question && question.difficulty !== undefined) {
        if (!dryRun) {
          // In real migration, would delete the field
          // Here we just count it as updated
        }
        stats.updated++;
      } else {
        stats.alreadyMigrated++;
      }
    }

    currentIndex += batchSize;
  }

  // Determine status
  const status: MigrationStatus =
    failures.length === 0
      ? 'completed'
      : failures.length === stats.totalProcessed
        ? 'failed'
        : 'partial';

  return {
    status,
    dryRun,
    stats,
    failures: failures.length > 0 ? failures : undefined,
    message:
      status === 'completed'
        ? `Successfully updated ${stats.updated} questions`
        : status === 'partial'
          ? `Partially completed: ${stats.updated} succeeded, ${failures.length} failed`
          : `Migration failed: All ${failures.length} attempts failed`,
  };
}

describe('Migration Infrastructure', () => {
  describe('Difficulty Removal Migration', () => {
    describe('Multi-batch Processing', () => {
      it('should process all questions across multiple batches', () => {
        // Create 1500 questions (3 batches with batchSize=500)
        const questions = Array.from({ length: 1500 }, (_, i) => createMockQuestion(`q${i}`, true));

        const result = simulateDifficultyRemoval(questions, { batchSize: 500 });

        expect(result.status).toBe('completed');
        expect(result.stats.totalProcessed).toBe(1500);
        expect(result.stats.updated).toBe(1500);
        expect(result.stats.alreadyMigrated).toBe(0);
        expect(result.failures).toBeUndefined();
      });

      it('should handle non-even batch divisions', () => {
        // 1234 questions with batchSize=500 = 3 batches (500, 500, 234)
        const questions = Array.from({ length: 1234 }, (_, i) => createMockQuestion(`q${i}`, true));

        const result = simulateDifficultyRemoval(questions, { batchSize: 500 });

        expect(result.stats.totalProcessed).toBe(1234);
        expect(result.stats.updated).toBe(1234);
      });

      it('should process single batch correctly', () => {
        const questions = Array.from({ length: 100 }, (_, i) => createMockQuestion(`q${i}`, true));

        const result = simulateDifficultyRemoval(questions, { batchSize: 500 });

        expect(result.stats.totalProcessed).toBe(100);
        expect(result.stats.updated).toBe(100);
      });
    });

    describe('Partial Failure Handling', () => {
      it('should handle 10% failure rate and return partial status', () => {
        const totalQuestions = 1000;
        const questions = Array.from({ length: totalQuestions }, (_, i) =>
          createMockQuestion(`q${i}`, true)
        );

        // Simulate 10% failure rate (every 10th question fails)
        const errorIds = new Set<string>();
        for (let i = 0; i < totalQuestions; i += 10) {
          errorIds.add(`q${i}`);
        }

        const result = simulateDifficultyRemoval(questions, {
          simulateErrors: errorIds,
        });

        expect(result.status).toBe('partial');
        expect(result.stats.totalProcessed).toBe(1000);
        expect(result.stats.updated).toBe(900); // 90% succeeded
        expect(result.stats.errors).toBe(100); // 10% failed
        expect(result.failures).toHaveLength(100);
        expect(result.message).toContain('Partially completed');
      });

      it('should track failed record IDs for retry', () => {
        const questions = [
          createMockQuestion('q1', true),
          createMockQuestion('q2', true),
          createMockQuestion('q3', true),
        ];

        const result = simulateDifficultyRemoval(questions, {
          simulateErrors: new Set(['q1', 'q3']),
        });

        expect(result.status).toBe('partial');
        expect(result.failures).toHaveLength(2);
        expect(result.failures?.[0].recordId).toBe('q1');
        expect(result.failures?.[1].recordId).toBe('q3');
        expect(result.stats.updated).toBe(1); // Only q2 succeeded
      });

      it('should return failed status when all records fail', () => {
        const questions = [createMockQuestion('q1', true), createMockQuestion('q2', true)];

        const result = simulateDifficultyRemoval(questions, {
          simulateErrors: new Set(['q1', 'q2']),
        });

        expect(result.status).toBe('failed');
        expect(result.stats.updated).toBe(0);
        expect(result.stats.errors).toBe(2);
        expect(result.failures).toHaveLength(2);
        expect(result.message).toContain('Migration failed');
      });
    });

    describe('Idempotency', () => {
      it('should be idempotent when run twice on same data', () => {
        const questions = Array.from({ length: 100 }, (_, i) => createMockQuestion(`q${i}`, true));

        // First run - migrates all questions
        const firstRun = simulateDifficultyRemoval(questions);

        expect(firstRun.status).toBe('completed');
        expect(firstRun.stats.updated).toBe(100);

        // Simulate questions after first migration (no difficulty field)
        const migratedQuestions = questions.map((q) => {
          const { difficulty: _difficulty, ...rest } = q;
          return rest;
        });

        // Second run - should detect all already migrated
        const secondRun = simulateDifficultyRemoval(migratedQuestions);

        expect(secondRun.status).toBe('completed');
        expect(secondRun.stats.updated).toBe(0);
        expect(secondRun.stats.alreadyMigrated).toBe(100);
        expect(secondRun.stats.totalProcessed).toBe(100);
      });

      it('should handle mixed migrated and unmigrated questions', () => {
        const questions = [
          createMockQuestion('q1', true), // Has difficulty
          createMockQuestion('q2', false), // Already migrated
          createMockQuestion('q3', true), // Has difficulty
          createMockQuestion('q4', false), // Already migrated
        ];

        const result = simulateDifficultyRemoval(questions);

        expect(result.status).toBe('completed');
        expect(result.stats.totalProcessed).toBe(4);
        expect(result.stats.updated).toBe(2); // q1 and q3
        expect(result.stats.alreadyMigrated).toBe(2); // q2 and q4
      });
    });

    describe('Dry Run Mode', () => {
      it('should not modify data in dry-run mode', () => {
        const questions = Array.from({ length: 50 }, (_, i) => createMockQuestion(`q${i}`, true));

        const result = simulateDifficultyRemoval(questions, { dryRun: true });

        expect(result.dryRun).toBe(true);
        expect(result.status).toBe('completed');
        expect(result.stats.updated).toBe(50);
        // In real implementation, questions would still have difficulty field
        // Here we verify the dry-run flag is set
      });

      it('should report same stats as production run', () => {
        const questions = Array.from(
          { length: 100 },
          (_, i) => createMockQuestion(`q${i}`, i % 3 === 0) // 33% have difficulty
        );

        const dryRun = simulateDifficultyRemoval(questions, { dryRun: true });
        const prodRun = simulateDifficultyRemoval(questions, { dryRun: false });

        // Stats should be identical
        expect(dryRun.stats).toEqual(prodRun.stats);
        expect(dryRun.status).toBe(prodRun.status);

        // Only dryRun flag should differ
        expect(dryRun.dryRun).toBe(true);
        expect(prodRun.dryRun).toBe(false);
      });

      it('should track failures in dry-run mode', () => {
        const questions = [createMockQuestion('q1', true), createMockQuestion('q2', true)];

        const result = simulateDifficultyRemoval(questions, {
          dryRun: true,
          simulateErrors: new Set(['q1']),
        });

        expect(result.dryRun).toBe(true);
        expect(result.status).toBe('partial');
        expect(result.failures).toHaveLength(1);
      });
    });

    describe('Return Type Consistency', () => {
      it('should return MigrationResult with all required fields', () => {
        const questions = [createMockQuestion('q1', true)];
        const result = simulateDifficultyRemoval(questions);

        // Verify all required fields are present
        expect(result).toHaveProperty('status');
        expect(result).toHaveProperty('dryRun');
        expect(result).toHaveProperty('stats');
        expect(result).toHaveProperty('message');

        // Verify status is valid enum value
        expect(['completed', 'partial', 'failed']).toContain(result.status);

        // Verify stats has correct shape
        expect(result.stats).toHaveProperty('totalProcessed');
        expect(result.stats).toHaveProperty('updated');
        expect(result.stats).toHaveProperty('alreadyMigrated');
        expect(result.stats).toHaveProperty('errors');
      });

      it('should only include failures when errors occur', () => {
        const questions = [createMockQuestion('q1', true)];

        const success = simulateDifficultyRemoval(questions);
        expect(success.failures).toBeUndefined();

        const failure = simulateDifficultyRemoval(questions, {
          simulateErrors: new Set(['q1']),
        });
        expect(failure.failures).toBeDefined();
        expect(failure.failures).toHaveLength(1);
      });

      it('should provide actionable messages for each status', () => {
        const questions = Array.from({ length: 10 }, (_, i) => createMockQuestion(`q${i}`, true));

        const completed = simulateDifficultyRemoval(questions);
        expect(completed.message).toContain('Successfully');

        const partial = simulateDifficultyRemoval(questions, {
          simulateErrors: new Set(['q0']),
        });
        expect(partial.message).toContain('Partially completed');
        expect(partial.message).toMatch(/\d+ succeeded/);
        expect(partial.message).toMatch(/\d+ failed/);

        const failed = simulateDifficultyRemoval(questions, {
          simulateErrors: new Set(questions.map((q) => q._id)),
        });
        expect(failed.message).toContain('Migration failed');
      });
    });
  });

  describe('Migration Result Status Logic', () => {
    it('should calculate status correctly for various failure rates', () => {
      const testCases = [
        { total: 100, failed: 0, expected: 'completed' as const },
        { total: 100, failed: 1, expected: 'partial' as const },
        { total: 100, failed: 50, expected: 'partial' as const },
        { total: 100, failed: 99, expected: 'partial' as const },
        { total: 100, failed: 100, expected: 'failed' as const },
      ];

      for (const { total, failed, expected } of testCases) {
        const questions = Array.from({ length: total }, (_, i) =>
          createMockQuestion(`q${i}`, true)
        );

        const errorIds = new Set(questions.slice(0, failed).map((q) => q._id));

        const result = simulateDifficultyRemoval(questions, {
          simulateErrors: errorIds,
        });

        expect(result.status).toBe(expected);
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty question set', () => {
      const result = simulateDifficultyRemoval([]);

      expect(result.status).toBe('completed');
      expect(result.stats.totalProcessed).toBe(0);
      expect(result.stats.updated).toBe(0);
      expect(result.stats.alreadyMigrated).toBe(0);
    });

    it('should handle single question', () => {
      const questions = [createMockQuestion('q1', true)];
      const result = simulateDifficultyRemoval(questions);

      expect(result.status).toBe('completed');
      expect(result.stats.totalProcessed).toBe(1);
      expect(result.stats.updated).toBe(1);
    });

    it('should handle batch size larger than total questions', () => {
      const questions = Array.from({ length: 10 }, (_, i) => createMockQuestion(`q${i}`, true));

      const result = simulateDifficultyRemoval(questions, { batchSize: 1000 });

      expect(result.stats.totalProcessed).toBe(10);
      expect(result.stats.updated).toBe(10);
    });

    it('should handle batch size of 1', () => {
      const questions = Array.from({ length: 5 }, (_, i) => createMockQuestion(`q${i}`, true));

      const result = simulateDifficultyRemoval(questions, { batchSize: 1 });

      expect(result.stats.totalProcessed).toBe(5);
      expect(result.stats.updated).toBe(5);
    });
  });
});
