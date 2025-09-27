import type { Id } from '@/convex/_generated/dataModel';
import type { Interaction, Question, SimpleQuestion } from '@/types/questions';

/**
 * Test fixtures for reusable test data
 * These provide consistent, predictable data for tests
 */

/**
 * Create a mock ID for Convex documents
 * In tests, we can use simple strings as IDs
 * Note: Uses 'any' type assertion for test flexibility
 */
export function createMockId(table: string, id: string = '123'): any {
  return `${table}-${id}`;
}

/**
 * Mock simple question (for quiz generation)
 */
export const mockSimpleQuestion: SimpleQuestion = {
  question: 'What is the capital of France?',
  type: 'multiple-choice',
  options: ['Paris', 'London', 'Berlin', 'Madrid'],
  correctAnswer: 'Paris',
  explanation: 'Paris has been the capital of France since 987 AD.',
};

/**
 * Mock question (from database)
 */
export const mockQuestion: Question = {
  _id: createMockId('questions', '1'),
  _creationTime: Date.now() - 86400000, // 1 day ago
  userId: createMockId('users', 'test-user'),
  topic: 'Geography',
  difficulty: 'easy',
  question: 'What is the capital of France?',
  type: 'multiple-choice',
  options: ['Paris', 'London', 'Berlin', 'Madrid'],
  correctAnswer: 'Paris',
  explanation: 'Paris has been the capital of France since 987 AD.',
  generatedAt: Date.now() - 86400000,
  attemptCount: 3,
  correctCount: 2,
  lastAttemptedAt: Date.now() - 3600000, // 1 hour ago
};

/**
 * Create a custom mock question with overrides
 */
export function createMockQuestion(overrides?: Partial<Question>): Question {
  return {
    ...mockQuestion,
    _id: createMockId('questions', Math.random().toString(36).substr(2, 9)),
    _creationTime: Date.now(),
    ...overrides,
  };
}

/**
 * Mock interaction (answer attempt)
 */
export const mockInteraction: Interaction = {
  _id: createMockId('interactions', '1'),
  _creationTime: Date.now() - 3600000, // 1 hour ago
  userId: createMockId('users', 'test-user'),
  questionId: mockQuestion._id,
  userAnswer: 'Paris',
  isCorrect: true,
  attemptedAt: Date.now() - 3600000,
  timeSpent: 15000, // 15 seconds
  context: {
    sessionId: 'session-123',
    isRetry: false,
  },
};

/**
 * Create a custom mock interaction with overrides
 */
export function createMockInteraction(overrides?: Partial<Interaction>): Interaction {
  return {
    ...mockInteraction,
    _id: createMockId('interactions', Math.random().toString(36).substr(2, 9)),
    _creationTime: Date.now(),
    attemptedAt: Date.now(),
    ...overrides,
  };
}

/**
 * Mock quiz session data
 */
export const mockQuizSession = {
  id: 'session-123',
  topic: 'Geography',
  difficulty: 'medium',
  startedAt: Date.now() - 600000, // 10 minutes ago
  questions: [
    createMockQuestion({ question: 'What is the capital of France?' }),
    createMockQuestion({ question: 'What is the largest ocean?' }),
    createMockQuestion({ question: 'Which continent is Egypt in?' }),
    createMockQuestion({ question: 'What is the longest river?' }),
    createMockQuestion({ question: 'How many continents are there?' }),
  ],
  currentQuestionIndex: 0,
  answers: [] as Array<{ questionId: string; answer: string; isCorrect: boolean }>,
};

/**
 * Create a batch of mock questions for testing lists
 */
export function createMockQuestions(count: number = 5): Question[] {
  const topics = ['Geography', 'Science', 'History', 'Math', 'Literature'];
  const difficulties = ['easy', 'medium', 'hard'];

  return Array.from({ length: count }, (_, i) =>
    createMockQuestion({
      _id: createMockId('questions', `q${i}`),
      topic: topics[i % topics.length],
      difficulty: difficulties[i % difficulties.length],
      question: `Sample question ${i + 1}?`,
      attemptCount: Math.floor(Math.random() * 10),
      correctCount: Math.floor(Math.random() * 5),
    })
  );
}

/**
 * Create a batch of mock interactions for testing history
 */
export function createMockInteractions(
  questionId: Id<'questions'>,
  count: number = 3
): Interaction[] {
  const answers = ['Paris', 'London', 'Berlin', 'Madrid'];

  return Array.from({ length: count }, (_, i) => {
    const userAnswer = answers[i % answers.length];
    return createMockInteraction({
      _id: createMockId('interactions', `i${i}`),
      questionId,
      userAnswer,
      isCorrect: userAnswer === 'Paris',
      attemptedAt: Date.now() - i * 3600000, // Each attempt 1 hour earlier
      timeSpent: 10000 + i * 5000, // Varying time spent
    });
  });
}

/**
 * Mock data for FSRS (spaced repetition)
 */
export const mockFSRSData = {
  nextReview: Date.now() + 86400000, // Tomorrow
  stability: 1.5,
  fsrsDifficulty: 0.3,
  elapsedDays: 1,
  scheduledDays: 1,
  reps: 1,
  lapses: 0,
  state: 'learning' as const,
  lastReview: Date.now() - 86400000, // Yesterday
};

/**
 * Create a question with FSRS data for spaced repetition tests
 */
export function createMockFSRSQuestion(overrides?: Partial<Question>): Question {
  return createMockQuestion({
    ...mockFSRSData,
    ...overrides,
  });
}

/**
 * Mock quiz completion result
 */
export const mockQuizResult = {
  score: 4,
  totalQuestions: 5,
  correctAnswers: 4,
  incorrectAnswers: 1,
  timeSpent: 300000, // 5 minutes
  completedAt: Date.now(),
  detailedAnswers: [
    { questionId: 'q1', userAnswer: 'Paris', isCorrect: true, timeSpent: 60000 },
    { questionId: 'q2', userAnswer: 'Pacific', isCorrect: true, timeSpent: 45000 },
    { questionId: 'q3', userAnswer: 'Africa', isCorrect: true, timeSpent: 50000 },
    { questionId: 'q4', userAnswer: 'Amazon', isCorrect: false, timeSpent: 70000 },
    { questionId: 'q5', userAnswer: '7', isCorrect: true, timeSpent: 75000 },
  ],
};
