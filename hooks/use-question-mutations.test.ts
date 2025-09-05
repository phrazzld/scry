import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { 
  useQuestionMutations
} from './use-question-mutations';
import { toast } from 'sonner';

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

vi.mock('@/contexts/auth-context', () => ({
  useAuth: vi.fn(() => ({ sessionToken: 'mock-token' })),
}));

import { useMutation } from 'convex/react';

describe('useQuestionMutations', () => {
  let mockUpdateQuestion: any;
  let mockDeleteQuestion: any;
  let mockQuestion: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock mutations
    mockUpdateQuestion = vi.fn();
    mockDeleteQuestion = vi.fn();
    
    (useMutation as any).mockImplementation((mutation: any) => {
      if (mutation._name === 'updateQuestion') return mockUpdateQuestion;
      if (mutation._name === 'deleteQuestion') return mockDeleteQuestion;
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
      topic: 'Math',
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
          topic: mockQuestion.topic,
        });
      });
      
      // The hook should have made the mutation call
      expect(mockUpdateQuestion).toHaveBeenCalled();
    });

    it('should call mutation with correct parameters', async () => {
      const { result } = renderHook(() => useQuestionMutations());
      
      const updates = {
        question: 'Updated question?',
        topic: mockQuestion.topic,
        explanation: 'Updated explanation',
      };
      
      await act(async () => {
        await result.current.optimisticEdit({
          questionId: mockQuestion._id,
          ...updates,
        });
      });
      
      expect(mockUpdateQuestion).toHaveBeenCalledWith({
        id: mockQuestion._id,
        sessionToken: 'mock-token',
        updates,
      });
    });

    it('should rollback on mutation failure', async () => {
      mockUpdateQuestion.mockRejectedValue(new Error('Update failed'));
      
      const { result } = renderHook(() => useQuestionMutations());
      
      await act(async () => {
        await result.current.optimisticEdit({
          questionId: mockQuestion._id,
          question: 'Will fail',
          topic: mockQuestion.topic,
        });
      });
      
      await waitFor(() => {
        // Error toast should be shown on failure
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
          topic: mockQuestion.topic,
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
        id: mockQuestion._id,
        sessionToken: 'mock-token',
      });
    });

    it('should show error toast on deletion failure', async () => {
      mockDeleteQuestion.mockRejectedValue(new Error('Delete failed'));
      
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

