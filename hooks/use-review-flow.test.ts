import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useReviewFlow } from './use-review-flow';

const {
  trackEventSpy,
  useTrackEventMock,
  useSimplePollMock,
  useDataHashMock,
} = vi.hoisted(() => {
  const trackEventSpy = vi.fn();
  const useTrackEventMock = vi.fn(() => trackEventSpy);
  const useSimplePollMock = vi.fn();
  const useDataHashMock = vi.fn(() => ({ hasChanged: true }));

  return { trackEventSpy, useTrackEventMock, useSimplePollMock, useDataHashMock };
});

vi.mock('@/hooks/use-track-event', () => ({
  useTrackEvent: useTrackEventMock,
}));

vi.mock('@/hooks/use-simple-poll', () => ({
  useSimplePoll: useSimplePollMock,
}));

vi.mock('@/hooks/use-data-hash', () => ({
  useDataHash: useDataHashMock,
}));

describe('useReviewFlow analytics integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useTrackEventMock.mockReturnValue(trackEventSpy);
    useDataHashMock.mockImplementation(() => ({ hasChanged: true }));
  });

  afterEach(() => {
    trackEventSpy.mockReset();
    useSimplePollMock.mockReset();
    useTrackEventMock.mockReset();
    useDataHashMock.mockReset();
  });

  function createNextReview(questionId: string) {
    return {
      question: {
        _id: questionId,
        question: 'What is AI?',
        options: ['Artificial Intelligence', 'Artificial Ice'],
        correctAnswer: 'Artificial Intelligence',
        explanation: 'It stands for Artificial Intelligence.',
      },
      interactions: [],
    };
  }

  it('tracks session start when the first question loads', async () => {
    let nextReviewValue = createNextReview('question-1');
    useSimplePollMock.mockImplementation(() => ({ data: nextReviewValue }));

    renderHook(() => useReviewFlow());

    await waitFor(() =>
      expect(trackEventSpy).toHaveBeenCalledWith(
        'Review Session Started',
        expect.objectContaining({
          sessionId: expect.any(String),
          questionsReviewed: 0,
          durationMs: 0,
        })
      )
    );
  });

  it('tracks completion with question count and duration', async () => {
    let nextReviewValue: any = createNextReview('question-1');
    useSimplePollMock.mockImplementation(() => ({ data: nextReviewValue }));

    const { result, rerender } = renderHook(() => useReviewFlow());

    await waitFor(() =>
      expect(trackEventSpy).toHaveBeenCalledWith(
        'Review Session Started',
        expect.objectContaining({
          sessionId: expect.any(String),
        })
      )
    );

    await act(async () => {
      nextReviewValue = null;
      await result.current.handlers.onReviewComplete();
      rerender();
    });

    await waitFor(() =>
      expect(trackEventSpy).toHaveBeenCalledWith(
        'Review Session Completed',
        expect.objectContaining({
          sessionId: expect.any(String),
          questionsReviewed: 1,
          durationMs: expect.any(Number),
        })
      )
    );
  });

  it('tracks abandonment when the hook unmounts mid-session', async () => {
    let nextReviewValue = createNextReview('question-1');
    useSimplePollMock.mockImplementation(() => ({ data: nextReviewValue }));

    const { unmount } = renderHook(() => useReviewFlow());

    await waitFor(() =>
      expect(trackEventSpy).toHaveBeenCalledWith(
        'Review Session Started',
        expect.objectContaining({
          sessionId: expect.any(String),
        })
      )
    );

    unmount();

    await waitFor(() =>
      expect(trackEventSpy).toHaveBeenCalledWith(
        'Review Session Abandoned',
        expect.objectContaining({
          sessionId: expect.any(String),
          questionsReviewed: 0,
          durationMs: expect.any(Number),
        })
      )
    );
  });
});
