import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ReviewFlow } from './review-flow';
import { toast } from 'sonner';

// Mock dependencies
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ 
    push: vi.fn(),
    back: vi.fn(),
  })),
}));

vi.mock('convex/react', () => ({
  useMutation: vi.fn(),
}));

vi.mock('@/hooks/use-polling-query', () => ({
  usePollingQuery: vi.fn(),
}));

vi.mock('@/hooks/use-keyboard-shortcuts', () => ({
  useReviewShortcuts: vi.fn(),
}));

vi.mock('@clerk/nextjs', () => ({
  useUser: vi.fn(() => ({ isSignedIn: true, user: { id: 'mock-token' } })),
  SignIn: vi.fn(() => <div data-testid="clerk-sign-in" />),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock components
vi.mock('@/components/empty-states', () => ({
  AllReviewsCompleteEmptyState: vi.fn(() => <div data-testid="all-reviews-complete">All reviews complete</div>),
  NoQuestionsEmptyState: vi.fn(() => <div data-testid="no-questions">No questions</div>),
}));

vi.mock('@/components/question-history', () => ({
  QuestionHistory: vi.fn(({ interactions }: any) => 
    <div data-testid="question-history">History: {interactions?.length || 0} attempts</div>
  ),
}));

vi.mock('@/components/keyboard-shortcuts-help', () => ({
  KeyboardShortcutsHelp: vi.fn(() => <div data-testid="shortcuts-help">Keyboard shortcuts</div>),
}));

vi.mock('@/components/edit-question-modal', () => ({
  EditQuestionModal: vi.fn(({ open }: any) => 
    open ? <div data-testid="edit-modal">Edit modal</div> : null
  ),
}));

import { useMutation } from 'convex/react';
import { usePollingQuery } from '@/hooks/use-polling-query';
import { useUser } from '@clerk/nextjs';

describe('ReviewFlow', () => {
  let mockScheduleReview: any;
  let mockUpdateQuestion: any;
  let mockDeleteQuestion: any;
  let mockRestoreQuestion: any;
  let mockCurrentReview: any;
  let mockDueCount: any;
  
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup default mocks
    mockScheduleReview = vi.fn();
    mockUpdateQuestion = vi.fn();
    mockDeleteQuestion = vi.fn();
    mockRestoreQuestion = vi.fn();
    
    (useMutation as any).mockImplementation((mutation: any) => {
      if (mutation._name === 'scheduleReview') return mockScheduleReview;
      if (mutation._name === 'updateQuestion') return mockUpdateQuestion;
      if (mutation._name === 'softDeleteQuestion') return mockDeleteQuestion;
      if (mutation._name === 'restoreQuestion') return mockRestoreQuestion;
      return vi.fn();
    });
    
    mockCurrentReview = {
      question: {
        _id: 'q1',
        question: 'What is React?',
        options: ['A library', 'A framework', 'A database', 'An OS'],
        correctAnswer: 'A library',
        topic: 'React',
        difficulty: 'easy',
        explanation: 'React is a JavaScript library for building user interfaces',
      },
      interactions: [],
      attemptCount: 0,
      correctCount: 0,
      successRate: null,
    };
    
    mockDueCount = {
      dueCount: 5,
      newCount: 2,
      totalReviewable: 7,
    };
  });

  describe('Initial Rendering', () => {
    it('should show loading state when no data is available', () => {
      (usePollingQuery as any).mockReturnValue(undefined);
      
      render(<ReviewFlow />);
      
      expect(screen.getByText(/Loading next review.../i)).toBeInTheDocument();
    });

    it('should show no questions empty state when user has no questions', () => {
      (usePollingQuery as any).mockImplementation((query: any) => {
        if (query._name === 'getNextReview') return null;
        if (query._name === 'getDueCount') return { dueCount: 0, newCount: 0, totalReviewable: 0 };
        return null;
      });
      
      render(<ReviewFlow />);
      
      expect(screen.getByTestId('no-questions')).toBeInTheDocument();
    });

    it('should show all reviews complete when questions exist but none are due', () => {
      (usePollingQuery as any).mockImplementation((query: any) => {
        if (query._name === 'getNextReview') return null;
        if (query._name === 'getDueCount') return { dueCount: 0, newCount: 0, totalReviewable: 10 };
        return null;
      });
      
      render(<ReviewFlow />);
      
      expect(screen.getByTestId('all-reviews-complete')).toBeInTheDocument();
    });

    it('should display current question when available', () => {
      (usePollingQuery as any).mockImplementation((query: any) => {
        if (query._name === 'getNextReview') return mockCurrentReview;
        if (query._name === 'getDueCount') return mockDueCount;
        return null;
      });
      
      render(<ReviewFlow />);
      
      expect(screen.getByText('What is React?')).toBeInTheDocument();
      expect(screen.getByText('A library')).toBeInTheDocument();
      expect(screen.getByText('A framework')).toBeInTheDocument();
    });
  });

  describe('Answer Selection', () => {
    beforeEach(() => {
      (usePollingQuery as any).mockImplementation((query: any) => {
        if (query._name === 'getNextReview') return mockCurrentReview;
        if (query._name === 'getDueCount') return mockDueCount;
        return null;
      });
    });

    it('should allow selecting an answer', () => {
      render(<ReviewFlow />);
      
      const option = screen.getByRole('button', { name: /A library/i });
      fireEvent.click(option);
      
      expect(option).toHaveClass('ring-2');
    });

    it('should enable submit button when answer is selected', () => {
      render(<ReviewFlow />);
      
      const submitButton = screen.getByRole('button', { name: /Submit Answer/i });
      expect(submitButton).toBeDisabled();
      
      const option = screen.getByRole('button', { name: /A library/i });
      fireEvent.click(option);
      
      expect(submitButton).not.toBeDisabled();
    });

    it('should change selection when different answer is clicked', () => {
      render(<ReviewFlow />);
      
      const option1 = screen.getByRole('button', { name: /A library/i });
      const option2 = screen.getByRole('button', { name: /A framework/i });
      
      fireEvent.click(option1);
      expect(option1).toHaveClass('ring-2');
      
      fireEvent.click(option2);
      expect(option2).toHaveClass('ring-2');
      expect(option1).not.toHaveClass('ring-2');
    });
  });

  describe('Answer Submission', () => {
    beforeEach(() => {
      (usePollingQuery as any).mockImplementation((query: any) => {
        if (query._name === 'getNextReview') return mockCurrentReview;
        if (query._name === 'getDueCount') return mockDueCount;
        return null;
      });
    });

    it('should submit correct answer and show success feedback', async () => {
      mockScheduleReview.mockResolvedValue({
        success: true,
        nextReview: Date.now() + 86400000, // 1 day
        scheduledDays: 1,
        newState: 'review',
      });
      
      render(<ReviewFlow />);
      
      const option = screen.getByRole('button', { name: /A library/i });
      fireEvent.click(option);
      
      const submitButton = screen.getByRole('button', { name: /Submit Answer/i });
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByText(/Correct!/i)).toBeInTheDocument();
      });
      
      expect(mockScheduleReview).toHaveBeenCalledWith({
        sessionToken: 'mock-token',
        questionId: 'q1',
        userAnswer: 'A library',
        isCorrect: true,
        timeSpent: expect.any(Number),
      });
    });

    it('should submit incorrect answer and show error feedback', async () => {
      mockScheduleReview.mockResolvedValue({
        success: true,
        nextReview: Date.now() + 600000, // 10 minutes
        scheduledDays: 0,
        newState: 'relearning',
      });
      
      render(<ReviewFlow />);
      
      const option = screen.getByRole('button', { name: /A framework/i });
      fireEvent.click(option);
      
      const submitButton = screen.getByRole('button', { name: /Submit Answer/i });
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByText(/Incorrect/i)).toBeInTheDocument();
      });
      
      expect(screen.getByText(/The correct answer was:/i)).toBeInTheDocument();
      expect(screen.getByText(/A library/i)).toBeInTheDocument();
    });

    it('should show error toast on submission failure', async () => {
      mockScheduleReview.mockRejectedValue(new Error('Network error'));
      
      render(<ReviewFlow />);
      
      const option = screen.getByRole('button', { name: /A library/i });
      fireEvent.click(option);
      
      const submitButton = screen.getByRole('button', { name: /Submit Answer/i });
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          'Unable to save your answer',
          expect.objectContaining({
            description: 'Network error',
          })
        );
      });
    });
  });

  describe('Question Navigation', () => {
    beforeEach(() => {
      const nextReview = {
        question: {
          _id: 'q2',
          question: 'What is JSX?',
          options: ['JavaScript XML', 'JSON Extended', 'Java Syntax', 'JS Extra'],
          correctAnswer: 'JavaScript XML',
          topic: 'React',
          difficulty: 'medium',
        },
        interactions: [],
        attemptCount: 0,
        correctCount: 0,
        successRate: null,
      };
      
      let callCount = 0;
      (usePollingQuery as any).mockImplementation((query: any) => {
        if (query._name === 'getNextReview') {
          // Return different questions for pre-fetching
          if (callCount === 0) {
            callCount++;
            return mockCurrentReview;
          }
          return nextReview;
        }
        if (query._name === 'getDueCount') return mockDueCount;
        return null;
      });
    });

    it('should advance to next question after feedback', async () => {
      mockScheduleReview.mockResolvedValue({
        success: true,
        nextReview: Date.now() + 86400000,
        scheduledDays: 1,
        newState: 'review',
      });
      
      render(<ReviewFlow />);
      
      // Answer current question
      const option = screen.getByRole('button', { name: /A library/i });
      fireEvent.click(option);
      
      const submitButton = screen.getByRole('button', { name: /Submit Answer/i });
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByText(/Correct!/i)).toBeInTheDocument();
      });
      
      // Click next button
      const nextButton = screen.getByRole('button', { name: /Next Question/i });
      fireEvent.click(nextButton);
      
      await waitFor(() => {
        expect(screen.getByText('What is JSX?')).toBeInTheDocument();
      });
    });
  });

  describe('Session Statistics', () => {
    beforeEach(() => {
      (usePollingQuery as any).mockImplementation((query: any) => {
        if (query._name === 'getNextReview') return mockCurrentReview;
        if (query._name === 'getDueCount') return mockDueCount;
        return null;
      });
    });

    it('should track completed questions in session', async () => {
      mockScheduleReview.mockResolvedValue({
        success: true,
        nextReview: Date.now() + 86400000,
        scheduledDays: 1,
        newState: 'review',
      });
      
      render(<ReviewFlow />);
      
      expect(screen.getByText(/Completed: 0/i)).toBeInTheDocument();
      
      // Answer question
      const option = screen.getByRole('button', { name: /A library/i });
      fireEvent.click(option);
      
      const submitButton = screen.getByRole('button', { name: /Submit Answer/i });
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByText(/Completed: 1/i)).toBeInTheDocument();
      });
    });

    it('should display due count', () => {
      render(<ReviewFlow />);
      
      expect(screen.getByText(/5 due/i)).toBeInTheDocument();
    });
  });

  describe('Unauthenticated State', () => {
    it('should show Clerk sign-in when not authenticated', () => {
      (useUser as any).mockReturnValue({ isSignedIn: false, user: null });
      (usePollingQuery as any).mockReturnValue(undefined);
      
      render(<ReviewFlow />);
      
      expect(screen.getByTestId('clerk-sign-in')).toBeInTheDocument();
    });
  });

  describe('Question History', () => {
    it('should display question history when available', () => {
      const reviewWithHistory = {
        ...mockCurrentReview,
        interactions: [
          { _id: 'i1', userAnswer: 'A framework', isCorrect: false },
          { _id: 'i2', userAnswer: 'A library', isCorrect: true },
        ],
      };
      
      (usePollingQuery as any).mockImplementation((query: any) => {
        if (query._name === 'getNextReview') return reviewWithHistory;
        if (query._name === 'getDueCount') return mockDueCount;
        return null;
      });
      
      render(<ReviewFlow />);
      
      expect(screen.getByTestId('question-history')).toBeInTheDocument();
      expect(screen.getByText(/History: 2 attempts/i)).toBeInTheDocument();
    });
  });
});
