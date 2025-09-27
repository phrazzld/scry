import { beforeEach, describe, expect, it } from 'vitest';

/**
 * Integration tests for complete question lifecycle
 *
 * Tests the full user journey: create → edit → delete → restore
 * These tests simulate end-to-end workflows with proper state management
 * and verify data integrity throughout the entire lifecycle.
 */

// Simulated question data for testing
const createQuestionData = () => ({
  question: 'What is the capital of France?',
  topic: 'Geography',
  explanation: 'Paris has been the capital of France since 987 AD.',
  options: ['Paris', 'London', 'Berlin', 'Madrid'],
  correctAnswer: 'Paris',
  difficulty: 'easy' as const,
  attemptCount: 0,
  correctCount: 0,
  userId: 'user_test_123',
  createdAt: Date.now(),
});

// Simulated FSRS data that should be preserved
const fsrsData = {
  stability: 4.5,
  fsrsDifficulty: 2.8,
  elapsedDays: 3,
  scheduledDays: 10,
  reps: 5,
  lapses: 1,
  state: 'review' as const,
  lastReview: Date.now() - 259200000, // 3 days ago
  nextReview: Date.now() + 864000000, // 10 days from now
};

// Type definitions for mock database
type MockQuestion = Record<string, unknown>;
type MockInteraction = Record<string, unknown>;
type MockUser = Record<string, unknown>;

// Simulated database state
interface MockDatabase {
  questions: Map<string, MockQuestion>;
  interactions: Map<string, MockInteraction>;
  users: Map<string, MockUser>;
}

class QuestionLifecycleSimulator {
  private db: MockDatabase;
  private nextId: number;

  constructor() {
    this.db = {
      questions: new Map(),
      interactions: new Map(),
      users: new Map(),
    };
    this.nextId = 1;
  }

  reset() {
    this.db.questions.clear();
    this.db.interactions.clear();
    this.db.users.clear();
    this.nextId = 1;
  }

  // Simulate create operation
  async createQuestion(data: MockQuestion, userId: string): Promise<MockQuestion> {
    const id = `q_${this.nextId++}`;
    const question = {
      _id: id,
      ...data,
      userId,
      createdAt: Date.now(),
      _creationTime: Date.now(),
    };
    this.db.questions.set(id, question);
    return question as MockQuestion;
  }

  // Simulate update operation with permission check
  async updateQuestion(
    id: string,
    updates: Partial<MockQuestion>,
    userId: string
  ): Promise<MockQuestion> {
    const question = this.db.questions.get(id);
    if (!question) {
      throw new Error('Question not found');
    }
    if (question.deletedAt) {
      throw new Error('Cannot update deleted question');
    }
    if (question.userId !== userId) {
      throw new Error('Unauthorized: Only creator can update');
    }

    // Only allow updating specific fields
    const allowedFields = ['question', 'topic', 'explanation'];
    const filteredUpdates: Partial<MockQuestion> = {};
    for (const field of allowedFields) {
      if (field in updates) {
        filteredUpdates[field] = updates[field];
      }
    }

    const updated = {
      ...question,
      ...filteredUpdates,
      updatedAt: Date.now(),
    };
    this.db.questions.set(id, updated);
    return updated as MockQuestion;
  }

  // Simulate soft delete with permission check
  async softDeleteQuestion(id: string, userId: string): Promise<MockQuestion> {
    const question = this.db.questions.get(id);
    if (!question) {
      throw new Error('Question not found');
    }
    if (question.deletedAt) {
      throw new Error('Question already deleted');
    }
    if (question.userId !== userId) {
      throw new Error('Unauthorized: Only creator can delete');
    }

    const deleted = {
      ...question,
      deletedAt: Date.now(),
    };
    this.db.questions.set(id, deleted);
    return deleted as MockQuestion;
  }

  // Simulate restore with permission check
  async restoreQuestion(id: string, userId: string): Promise<MockQuestion> {
    const question = this.db.questions.get(id);
    if (!question) {
      throw new Error('Question not found');
    }
    if (!question.deletedAt) {
      throw new Error('Question is not deleted');
    }
    if (question.userId !== userId) {
      throw new Error('Unauthorized: Only creator can restore');
    }

    const restored = { ...question };
    delete restored.deletedAt;
    this.db.questions.set(id, restored);
    return restored as MockQuestion;
  }

  // Simulate interaction recording
  async recordInteraction(questionId: string, userId: string, isCorrect: boolean) {
    const question = this.db.questions.get(questionId);
    if (!question) {
      throw new Error('Question not found');
    }
    if (question.deletedAt) {
      throw new Error('Cannot interact with deleted question');
    }

    const interactionId = `i_${this.nextId++}`;
    const interaction = {
      _id: interactionId,
      questionId,
      userId,
      isCorrect,
      attemptedAt: Date.now(),
      timeSpent: Math.floor(Math.random() * 30000) + 5000, // 5-35 seconds
    };
    this.db.interactions.set(interactionId, interaction);

    // Update question stats
    question.attemptCount = ((question.attemptCount as number) || 0) + 1;
    if (isCorrect) {
      question.correctCount = ((question.correctCount as number) || 0) + 1;
    }
    this.db.questions.set(questionId, question);

    return interaction;
  }

  // Query methods
  getQuestion(id: string) {
    return this.db.questions.get(id);
  }

  getUserQuestions(userId: string, includeDeleted = false) {
    const questions = [];
    for (const question of this.db.questions.values()) {
      if (question.userId === userId) {
        if (!includeDeleted && question.deletedAt) continue;
        questions.push(question);
      }
    }
    return questions;
  }

  getQuestionInteractions(questionId: string) {
    const interactions = [];
    for (const interaction of this.db.interactions.values()) {
      if (interaction.questionId === questionId) {
        interactions.push(interaction);
      }
    }
    return interactions;
  }
}

describe('Question Lifecycle Integration Tests', () => {
  let simulator: QuestionLifecycleSimulator;
  const testUserId = 'user_test_123';
  const otherUserId = 'user_other_456';

  beforeEach(() => {
    simulator = new QuestionLifecycleSimulator();
  });

  describe('Complete Question Lifecycle', () => {
    it('should handle create → edit → delete → restore flow', async () => {
      // Step 1: Create a question
      const questionData = createQuestionData();
      const created = await simulator.createQuestion(questionData, testUserId);

      expect(created._id as string).toBeDefined();
      expect(created['question']).toBe(questionData.question);
      expect(created.userId).toBe(testUserId);
      expect(created['deletedAt']).toBeUndefined();

      // Step 2: Edit the question
      const updates = {
        question: 'What is the capital city of France?',
        explanation: 'Paris has been the capital since the Capetian dynasty.',
      };
      const edited = await simulator.updateQuestion(created._id as string, updates, testUserId);

      expect(edited['question']).toBe(updates.question);
      expect(edited['explanation']).toBe(updates.explanation);
      expect(edited['topic']).toBe(questionData.topic); // Unchanged
      expect(edited.updatedAt).toBeDefined();

      // Step 3: Delete the question
      const deleted = await simulator.softDeleteQuestion(created._id as string, testUserId);

      expect(deleted.deletedAt).toBeDefined();
      expect(deleted['question']).toBe(updates.question); // Data preserved

      // Verify it's excluded from active queries
      const activeQuestions = simulator.getUserQuestions(testUserId, false);
      expect(activeQuestions).toHaveLength(0);

      // Step 4: Restore the question
      const restored = await simulator.restoreQuestion(created._id as string, testUserId);

      expect(restored.deletedAt).toBeUndefined();
      expect(restored['question']).toBe(updates.question); // Data still preserved

      // Verify it's included in active queries again
      const questionsAfterRestore = simulator.getUserQuestions(testUserId, false);
      expect(questionsAfterRestore).toHaveLength(1);
      expect(questionsAfterRestore[0]._id).toBe(created._id as string);
    });

    it('should preserve FSRS data throughout lifecycle', async () => {
      // Create question with FSRS data
      const questionData = {
        ...createQuestionData(),
        ...fsrsData,
      };
      const created = await simulator.createQuestion(questionData, testUserId);

      // Verify FSRS data is present
      expect(created['stability']).toBe(fsrsData.stability);
      expect(created['fsrsDifficulty']).toBe(fsrsData.fsrsDifficulty);
      expect(created['state']).toBe(fsrsData.state);

      // Edit the question
      const updates = {
        question: 'Updated question text',
        stability: 999, // Should NOT be updated
        reps: 999, // Should NOT be updated
      };
      const edited = await simulator.updateQuestion(created._id as string, updates, testUserId);

      // Verify FSRS data is preserved (not overwritten)
      expect(edited['question']).toBe('Updated question text');
      expect(edited['stability']).toBe(fsrsData.stability); // NOT 999
      expect(edited['reps']).toBe(fsrsData.reps); // NOT 999

      // Delete the question
      const deleted = await simulator.softDeleteQuestion(created._id as string, testUserId);

      // Verify FSRS data is still preserved
      expect(deleted['stability']).toBe(fsrsData.stability);
      expect(deleted['fsrsDifficulty']).toBe(fsrsData.fsrsDifficulty);
      expect(deleted['state']).toBe(fsrsData.state);

      // Restore the question
      const restored = await simulator.restoreQuestion(created._id as string, testUserId);

      // Verify FSRS data is still intact after restore
      expect(restored['stability']).toBe(fsrsData.stability);
      expect(restored['fsrsDifficulty']).toBe(fsrsData.fsrsDifficulty);
      expect(restored['state']).toBe(fsrsData.state);
      expect(restored['nextReview']).toBe(fsrsData.nextReview);
    });
  });

  describe('Permission Boundaries', () => {
    it('should enforce creator-only permissions for all operations', async () => {
      // Create a question as testUserId
      const question = await simulator.createQuestion(createQuestionData(), testUserId);

      // Try to update as different user - should fail
      await expect(
        simulator.updateQuestion(question._id as string, { question: 'Hacked!' }, otherUserId)
      ).rejects.toThrow('Unauthorized: Only creator can update');

      // Try to delete as different user - should fail
      await expect(
        simulator.softDeleteQuestion(question._id as string, otherUserId)
      ).rejects.toThrow('Unauthorized: Only creator can delete');

      // Delete as owner - should succeed
      await simulator.softDeleteQuestion(question._id as string, testUserId);

      // Try to restore as different user - should fail
      await expect(simulator.restoreQuestion(question._id as string, otherUserId)).rejects.toThrow(
        'Unauthorized: Only creator can restore'
      );

      // Restore as owner - should succeed
      const restored = await simulator.restoreQuestion(question._id as string, testUserId);
      expect(restored.deletedAt).toBeUndefined();
    });

    it('should prevent operations on non-existent questions', async () => {
      const fakeId = 'q_nonexistent';

      await expect(
        simulator.updateQuestion(fakeId, { question: 'Test' }, testUserId)
      ).rejects.toThrow('Question not found');

      await expect(simulator.softDeleteQuestion(fakeId, testUserId)).rejects.toThrow(
        'Question not found'
      );

      await expect(simulator.restoreQuestion(fakeId, testUserId)).rejects.toThrow(
        'Question not found'
      );
    });
  });

  describe('State Transition Validations', () => {
    it('should prevent invalid state transitions', async () => {
      const question = await simulator.createQuestion(createQuestionData(), testUserId);

      // Cannot restore an active question
      await expect(simulator.restoreQuestion(question._id as string, testUserId)).rejects.toThrow(
        'Question is not deleted'
      );

      // Delete the question
      await simulator.softDeleteQuestion(question._id as string, testUserId);

      // Cannot delete an already deleted question
      await expect(
        simulator.softDeleteQuestion(question._id as string, testUserId)
      ).rejects.toThrow('Question already deleted');

      // Cannot update a deleted question
      await expect(
        simulator.updateQuestion(question._id as string, { question: 'Test' }, testUserId)
      ).rejects.toThrow('Cannot update deleted question');

      // Cannot record interaction on deleted question
      await expect(
        simulator.recordInteraction(question._id as string, testUserId, true)
      ).rejects.toThrow('Cannot interact with deleted question');
    });
  });

  describe('Interaction Tracking', () => {
    it('should track interactions and update stats correctly', async () => {
      const question = await simulator.createQuestion(createQuestionData(), testUserId);

      // Record some interactions
      await simulator.recordInteraction(question._id as string, testUserId, true);
      await simulator.recordInteraction(question._id as string, testUserId, false);
      await simulator.recordInteraction(question._id as string, testUserId, true);

      // Check updated stats
      const updated = simulator.getQuestion(question._id as string)!;
      expect(updated['attemptCount']).toBe(3);
      expect(updated['correctCount']).toBe(2);

      // Verify interactions are stored
      const interactions = simulator.getQuestionInteractions(question._id as string);
      expect(interactions).toHaveLength(3);
      expect(interactions[0].isCorrect).toBe(true);
      expect(interactions[1].isCorrect).toBe(false);
      expect(interactions[2].isCorrect).toBe(true);
    });

    it('should maintain interaction history through delete/restore', async () => {
      const question = await simulator.createQuestion(createQuestionData(), testUserId);

      // Record interactions
      await simulator.recordInteraction(question._id as string, testUserId, true);
      await simulator.recordInteraction(question._id as string, testUserId, false);

      // Delete the question
      await simulator.softDeleteQuestion(question._id as string, testUserId);

      // Interactions should still be queryable
      const interactions = simulator.getQuestionInteractions(question._id as string);
      expect(interactions).toHaveLength(2);

      // Restore the question
      await simulator.restoreQuestion(question._id as string, testUserId);

      // Stats should be preserved
      const restored = simulator.getQuestion(question._id as string)!;
      expect(restored['attemptCount']).toBe(2);
      expect(restored['correctCount']).toBe(1);

      // Can add new interactions after restore
      await simulator.recordInteraction(question._id as string, testUserId, true);

      const finalQuestion = simulator.getQuestion(question._id as string)!;
      expect(finalQuestion['attemptCount']).toBe(3);
      expect(finalQuestion['correctCount']).toBe(2);
    });
  });

  describe('Batch Operations', () => {
    it('should handle multiple questions lifecycle independently', async () => {
      // Create multiple questions
      const q1 = await simulator.createQuestion(
        { ...createQuestionData(), question: 'Question 1' },
        testUserId
      );
      const q2 = await simulator.createQuestion(
        { ...createQuestionData(), question: 'Question 2' },
        testUserId
      );
      const q3 = await simulator.createQuestion(
        { ...createQuestionData(), question: 'Question 3' },
        testUserId
      );

      // Delete q1 and q3, keep q2 active
      await simulator.softDeleteQuestion(q1._id as string, testUserId);
      await simulator.softDeleteQuestion(q3._id as string, testUserId);

      // Query active questions
      const activeQuestions = simulator.getUserQuestions(testUserId, false);
      expect(activeQuestions).toHaveLength(1);
      expect(activeQuestions[0]._id).toBe(q2._id as string);

      // Query all questions including deleted
      const allQuestions = simulator.getUserQuestions(testUserId, true);
      expect(allQuestions).toHaveLength(3);

      // Restore q1
      await simulator.restoreQuestion(q1._id as string, testUserId);

      // Now should have 2 active questions
      const finalActive = simulator.getUserQuestions(testUserId, false);
      expect(finalActive).toHaveLength(2);
      expect(finalActive.map((q) => q._id).sort()).toEqual(
        [q1._id as string, q2._id as string].sort()
      );
    });
  });
});
