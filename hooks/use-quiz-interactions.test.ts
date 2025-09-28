import { useUser } from '@clerk/nextjs';
import { act, renderHook } from '@testing-library/react';
import { useMutation } from 'convex/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useQuizInteractions } from './use-quiz-interactions';

// Mock dependencies
vi.mock('convex/react', () => ({
  useMutation: vi.fn(),
}));

vi.mock('@clerk/nextjs', () => ({
  useUser: vi.fn(() => ({ isSignedIn: true, user: { id: 'test-token' } })),
}));

describe('useQuizInteractions', () => {
  let mockRecordInteraction: any;
  let consoleErrorSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock console.error to verify error handling
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Setup default mocks
    mockRecordInteraction = vi.fn();
    (useMutation as any).mockReturnValue(mockRecordInteraction);
    (useUser as any).mockReturnValue({ isSignedIn: true, user: { id: 'test-token' } });
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe('trackAnswer', () => {
    it('should record interaction with all parameters', async () => {
      const mockResult = {
        nextReview: new Date('2025-01-20T12:00:00Z'),
        scheduledDays: 5,
        newState: 'review',
      };

      mockRecordInteraction.mockResolvedValue(mockResult);

      const { result } = renderHook(() => useQuizInteractions());

      let response: any;
      await act(async () => {
        response = await result.current.trackAnswer(
          'question-1',
          'Answer A',
          true,
          15000,
          'session-1'
        );
      });

      expect(mockRecordInteraction).toHaveBeenCalledWith({
        questionId: 'question-1',
        userAnswer: 'Answer A',
        isCorrect: true,
        timeSpent: 15000,
        sessionId: 'session-1',
      });

      expect(response).toEqual({
        nextReview: mockResult.nextReview,
        scheduledDays: mockResult.scheduledDays,
        newState: mockResult.newState,
      });
    });

    it('should record interaction with minimal parameters', async () => {
      const mockResult = {
        nextReview: null,
        scheduledDays: null,
        newState: null,
      };

      mockRecordInteraction.mockResolvedValue(mockResult);

      const { result } = renderHook(() => useQuizInteractions());

      let response: any;
      await act(async () => {
        response = await result.current.trackAnswer('question-2', 'Answer B', false);
      });

      expect(mockRecordInteraction).toHaveBeenCalledWith({
        questionId: 'question-2',
        userAnswer: 'Answer B',
        isCorrect: false,
        timeSpent: undefined,
        sessionId: undefined,
      });

      expect(response).toEqual({
        nextReview: null,
        scheduledDays: null,
        newState: null,
      });
    });

    it('should return null when no session token', async () => {
      (useUser as any).mockReturnValue({ isSignedIn: false, user: null });

      const { result } = renderHook(() => useQuizInteractions());

      let response: any;
      await act(async () => {
        response = await result.current.trackAnswer('question-3', 'Answer C', true);
      });

      expect(mockRecordInteraction).not.toHaveBeenCalled();
      expect(response).toBeNull();
    });

    it('should return null when no question ID', async () => {
      const { result } = renderHook(() => useQuizInteractions());

      let response: any;
      await act(async () => {
        response = await result.current.trackAnswer('', 'Answer D', false);
      });

      expect(mockRecordInteraction).not.toHaveBeenCalled();
      expect(response).toBeNull();
    });

    it('should handle errors gracefully', async () => {
      // Mock NODE_ENV to be development for console.error to fire
      vi.stubEnv('NODE_ENV', 'development');

      const mockError = new Error('Database error');
      mockRecordInteraction.mockRejectedValue(mockError);

      const { result } = renderHook(() => useQuizInteractions());

      let response: any;
      await act(async () => {
        response = await result.current.trackAnswer('question-4', 'Answer E', true);
      });

      expect(mockRecordInteraction).toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to track interaction:', mockError);
      expect(response).toBeNull();

      // Restore original NODE_ENV (vi.stubEnv is automatically cleaned up)
      vi.unstubAllEnvs();
    });

    it('should memoize trackAnswer based on dependencies', () => {
      const { result, rerender } = renderHook(() => useQuizInteractions());

      const trackAnswer1 = result.current.trackAnswer;

      // Re-render with same dependencies
      rerender();
      const trackAnswer2 = result.current.trackAnswer;

      // Should be the same function reference
      expect(trackAnswer1).toBe(trackAnswer2);

      // Change isSignedIn status
      (useUser as any).mockReturnValue({ isSignedIn: false });
      rerender();
      const trackAnswer3 = result.current.trackAnswer;

      // Should be a new function reference
      expect(trackAnswer1).not.toBe(trackAnswer3);
    });

    it('should handle spaced repetition data in response', async () => {
      const mockResult = {
        nextReview: new Date('2025-01-25T10:30:00Z'),
        scheduledDays: 10,
        newState: 'learning',
        // Extra fields that might be returned but not used
        interactionId: 'interaction-123',
        attemptCount: 5,
      };

      mockRecordInteraction.mockResolvedValue(mockResult);

      const { result } = renderHook(() => useQuizInteractions());

      let response: any;
      await act(async () => {
        response = await result.current.trackAnswer('question-5', 'Answer F', true, 8500);
      });

      // Should only return the spaced repetition fields
      expect(response).toEqual({
        nextReview: mockResult.nextReview,
        scheduledDays: mockResult.scheduledDays,
        newState: mockResult.newState,
      });

      // Should not include extra fields
      expect(response).not.toHaveProperty('interactionId');
      expect(response).not.toHaveProperty('attemptCount');
    });

    it('should work with both authenticated and unauthenticated users', async () => {
      // Start authenticated
      const { result, rerender } = renderHook(() => useQuizInteractions());

      mockRecordInteraction.mockResolvedValue({
        nextReview: new Date(),
        scheduledDays: 1,
        newState: 'new',
      });

      let response: any;
      await act(async () => {
        response = await result.current.trackAnswer('q1', 'a1', true);
      });

      expect(response).toBeDefined();
      expect(mockRecordInteraction).toHaveBeenCalledTimes(1);

      // Switch to unauthenticated
      (useUser as any).mockReturnValue({ isSignedIn: false, user: null });
      rerender();

      await act(async () => {
        response = await result.current.trackAnswer('q2', 'a2', false);
      });

      expect(response).toBeNull();
      expect(mockRecordInteraction).toHaveBeenCalledTimes(1); // Still 1, not called again
    });
  });

  describe('hook integration', () => {
    it('should use correct Convex API mutation', () => {
      renderHook(() => useQuizInteractions());

      // Simply check that useMutation was called
      expect(useMutation).toHaveBeenCalled();
    });

    it('should use auth context for session token', () => {
      renderHook(() => useQuizInteractions());

      expect(useUser).toHaveBeenCalled();
    });
  });
});
