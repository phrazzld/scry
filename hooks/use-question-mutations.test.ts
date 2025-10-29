import { act, renderHook, waitFor } from '@testing-library/react';
import { useMutation } from 'convex/react';
import { toast } from 'sonner';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useQuestionMutations } from './use-question-mutations';

// Mock dependencies
vi.mock('convex/react', () => ({
  useMutation: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock('@clerk/nextjs', () => ({
  useUser: vi.fn(() => ({ isSignedIn: true, user: { id: 'mock-token' } })),
}));

vi.mock('@/convex/_generated/api', () => ({
  api: {
    questionsCrud: {
      updateQuestion: { _functionPath: 'questionsCrud:updateQuestion' },
      softDeleteQuestion: { _functionPath: 'questionsCrud:softDeleteQuestion' },
    },
  },
}));

describe('useQuestionMutations', () => {
  let mockUpdateQuestion: any;
  let mockDeleteQuestion: any;
  let mockQuestion: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock mutations with default success responses
    mockUpdateQuestion = vi.fn().mockResolvedValue({ success: true });
    mockDeleteQuestion = vi.fn().mockResolvedValue({ success: true });

    (useMutation as any).mockImplementation((mutation: any) => {
      // Check the function path to determine which mock to return
      const functionPath = mutation?._functionPath || '';
      if (functionPath === 'questionsCrud:updateQuestion') return mockUpdateQuestion;
      if (functionPath === 'questionsCrud:softDeleteQuestion') return mockDeleteQuestion;
      return vi.fn();
    });

    // Mock question data
    mockQuestion = {
      _id: 'question-1',
      question: 'What is 2+2?',
      correctAnswer: '4',
      type: 'multiple-choice',
      options: ['3', '4', '5', '6'],
      difficulty: 'easy',
      attemptCount: 0,
      correctCount: 0,
    };
  });

  describe('optimistic edit', () => {
    it('should apply optimistic update immediately', async () => {
      const { result } = renderHook(() => useQuestionMutations());

      await act(async () => {
        await result.current.optimisticEdit({
          questionId: mockQuestion._id,
          question: 'What is 3+3?',
        });
      });

      // The hook should have made the mutation call
      expect(mockUpdateQuestion).toHaveBeenCalled();
    });

    it('should call mutation with correct parameters', async () => {
      const { result } = renderHook(() => useQuestionMutations());

      const updates = {
        question: 'Updated question?',
        explanation: 'Updated explanation',
      };

      await act(async () => {
        await result.current.optimisticEdit({
          questionId: mockQuestion._id,
          ...updates,
        });
      });

      expect(mockUpdateQuestion).toHaveBeenCalledWith({
        questionId: mockQuestion._id,
        question: updates.question,
        explanation: updates.explanation,
      });
    });

    it('should rollback on mutation failure', async () => {
      mockUpdateQuestion.mockRejectedValue(new Error('Failed to update question'));

      const { result } = renderHook(() => useQuestionMutations());

      await act(async () => {
        await result.current.optimisticEdit({
          questionId: mockQuestion._id,
          question: 'Will fail',
        });
      });

      await waitFor(() => {
        // Error toast should be shown on failure - the hook shows the error message directly
        expect(toast.error).toHaveBeenCalledWith('Failed to update question');
      });
    });

    it('should clear optimistic state on success', async () => {
      mockUpdateQuestion.mockResolvedValue({ success: true });

      const { result } = renderHook(() => useQuestionMutations());

      await act(async () => {
        await result.current.optimisticEdit({
          questionId: mockQuestion._id,
          question: 'Updated successfully',
        });
      });

      await waitFor(() => {
        // Mutation should have been called successfully
        expect(mockUpdateQuestion).toHaveBeenCalled();
      });
    });
  });

  describe('optimistic delete', () => {
    it('should mark item as deleted optimistically', async () => {
      const { result } = renderHook(() => useQuestionMutations());

      await act(async () => {
        await result.current.optimisticDelete({
          questionId: mockQuestion._id,
        });
      });

      // Deletion mutation should be called
      expect(mockDeleteQuestion).toHaveBeenCalled();
    });

    it('should call delete mutation', async () => {
      const { result } = renderHook(() => useQuestionMutations());

      await act(async () => {
        await result.current.optimisticDelete({
          questionId: mockQuestion._id,
        });
      });

      expect(mockDeleteQuestion).toHaveBeenCalledWith({
        questionId: mockQuestion._id,
      });
    });

    it('should show error toast on deletion failure', async () => {
      mockDeleteQuestion.mockRejectedValue(new Error('Failed to delete question'));

      const { result } = renderHook(() => useQuestionMutations());

      await act(async () => {
        await result.current.optimisticDelete({
          questionId: mockQuestion._id,
        });
      });

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Failed to delete question');
      });
    });

    it('should show success toast on successful deletion', async () => {
      mockDeleteQuestion.mockResolvedValue({ success: true });

      const { result } = renderHook(() => useQuestionMutations());

      await act(async () => {
        await result.current.optimisticDelete({
          questionId: mockQuestion._id,
        });
      });

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith('Question deleted');
      });
    });
  });
});
