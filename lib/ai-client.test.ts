import { generateObject, generateText } from 'ai';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { generateQuizWithAI } from './ai-client';
import { aiLogger, loggers } from './logger';

// Mock dependencies
vi.mock('@ai-sdk/google', () => ({
  createGoogleGenerativeAI: vi.fn(() => vi.fn()),
}));

vi.mock('ai', () => ({
  generateObject: vi.fn(),
  generateText: vi.fn(),
}));

vi.mock('./logger', () => ({
  aiLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  loggers: {
    error: vi.fn(),
    time: vi.fn(() => ({
      end: vi.fn(() => 100),
    })),
  },
}));

// No more prompt sanitization mocks needed - we trust the model

// Helper to create mock generateObject result
function createMockResult(object: any) {
  return {
    object,
    finishReason: 'stop' as const,
    usage: { promptTokens: 100, completionTokens: 200, totalTokens: 300 },
    warnings: undefined,
    request: {} as any,
    response: { id: 'test', timestamp: new Date(), modelId: 'test' },
    experimental_providerMetadata: undefined,
    providerMetadata: undefined,
    rawResponse: undefined,
    logprobs: undefined,
    toJsonResponse: () => new Response(JSON.stringify(object)),
  };
}

// Helper to create mock generateText result
function createMockTextResult(text: string) {
  return {
    text,
    finishReason: 'stop' as const,
    usage: { promptTokens: 50, completionTokens: 100, totalTokens: 150 },
    warnings: undefined,
    request: {} as any,
    response: { id: 'test', timestamp: new Date(), modelId: 'test' },
    experimental_providerMetadata: undefined,
    providerMetadata: undefined,
    rawResponse: undefined,
    logprobs: undefined,
    reasoning: undefined,
    files: undefined,
    reasoningDetails: undefined,
    sources: undefined,
    experimental_reasoning: undefined,
    experimental_files: undefined,
    experimental_reasoningDetails: undefined,
    experimental_sources: undefined,
    experimental_output: undefined,
    toolCalls: [],
    toolResults: [],
    steps: [],
    toJsonResponse: () => new Response(JSON.stringify({ text })),
  };
}

describe('AI Client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset env var
    process.env.GOOGLE_AI_API_KEY = 'test-api-key';

    // Default mock for intent clarification (can be overridden in specific tests)
    vi.mocked(generateText).mockResolvedValue(
      createMockTextResult(
        'The learner wants to study this topic. Key learning objectives include understanding the core concepts and applications.'
      ) as any
    );
  });

  describe('generateQuizWithAI', () => {
    it('should generate questions successfully', async () => {
      const mockQuestions = {
        questions: [
          {
            question: 'What is JavaScript?',
            type: 'multiple-choice',
            options: ['A programming language', 'A database', 'An OS', 'A framework'],
            correctAnswer: 'A programming language',
            explanation: 'JavaScript is a programming language used for web development',
          },
          {
            question: 'JavaScript is dynamically typed',
            type: 'true-false',
            options: ['True', 'False'],
            correctAnswer: 'True',
            explanation: 'JavaScript uses dynamic typing',
          },
        ],
      };

      vi.mocked(generateObject).mockResolvedValue(createMockResult(mockQuestions));

      const result = await generateQuizWithAI('JavaScript');

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        question: 'What is JavaScript?',
        type: 'multiple-choice',
        options: expect.arrayContaining(['A programming language']),
        correctAnswer: 'A programming language',
      });

      // Verify logging
      expect(aiLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'ai.question-generation.start',
          topic: 'JavaScript',
        }),
        expect.any(String)
      );
    });

    it('should surface configuration error when API key is missing', async () => {
      process.env.GOOGLE_AI_API_KEY = '';

      await expect(generateQuizWithAI('No Key')).rejects.toThrow(
        'GOOGLE_AI_API_KEY not configured in Next.js environment'
      );

      expect(aiLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'ai.google-client.missing-key',
        }),
        'GOOGLE_AI_API_KEY not configured in Next.js environment'
      );
    });

    it('should handle questions with missing optional fields', async () => {
      const mockQuestions = {
        questions: [
          {
            question: 'Test question?',
            options: ['A', 'B'],
            correctAnswer: 'A',
            // No type or explanation
          },
        ],
      };

      vi.mocked(generateObject).mockResolvedValue(createMockResult(mockQuestions));

      const result = await generateQuizWithAI('Test Topic');

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        question: 'Test question?',
        type: 'multiple-choice', // Should default to multiple-choice
        options: ['A', 'B'],
        correctAnswer: 'A',
        explanation: undefined,
      });
    });

    it('should throw error on AI generation failure', async () => {
      const error = new Error('AI service unavailable');
      vi.mocked(generateObject).mockRejectedValue(error);

      // Should throw error instead of returning fallback
      await expect(generateQuizWithAI('Mathematics')).rejects.toThrow('AI service unavailable');

      // Verify error logging
      expect(loggers.error).toHaveBeenCalledWith(
        error,
        'ai',
        expect.objectContaining({
          event: 'ai.question-generation.failure',
          topic: 'Mathematics',
          errorType: 'generation-error',
        }),
        'Failed to generate questions: AI service unavailable'
      );
    });

    it('should throw API key error with proper error type', async () => {
      const error = new Error('API key not configured');
      vi.mocked(generateObject).mockRejectedValue(error);

      await expect(generateQuizWithAI('Physics')).rejects.toThrow('API key not configured');

      expect(loggers.error).toHaveBeenCalledWith(
        error,
        'ai',
        expect.objectContaining({
          errorType: 'api-key-error',
        }),
        expect.any(String)
      );
    });

    it('should throw rate limit error with proper error type', async () => {
      const error = new Error('Rate limit exceeded');
      vi.mocked(generateObject).mockRejectedValue(error);

      await expect(generateQuizWithAI('Chemistry')).rejects.toThrow('Rate limit exceeded');

      expect(loggers.error).toHaveBeenCalledWith(
        error,
        'ai',
        expect.objectContaining({
          errorType: 'rate-limit-error',
        }),
        expect.any(String)
      );
    });

    it('should throw timeout error with proper error type', async () => {
      const error = new Error('Request timed out');
      vi.mocked(generateObject).mockRejectedValue(error);

      await expect(generateQuizWithAI('Biology')).rejects.toThrow('Request timed out');

      expect(loggers.error).toHaveBeenCalledWith(
        error,
        'ai',
        expect.objectContaining({
          errorType: 'timeout-error',
        }),
        expect.any(String)
      );
    });

    it('should handle empty response from AI', async () => {
      const mockQuestions = {
        questions: [],
      };

      vi.mocked(generateObject).mockResolvedValue(createMockResult(mockQuestions));

      const result = await generateQuizWithAI('Empty Topic');

      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });

    it('should pass topics through without modification', async () => {
      const mockQuestions = {
        questions: [
          {
            question: 'Test',
            options: ['A', 'B'],
            correctAnswer: 'A',
          },
        ],
      };

      vi.mocked(generateObject).mockResolvedValue(createMockResult(mockQuestions));

      await generateQuizWithAI('the NATO alphabet');

      // Topic should be passed through as-is
      expect(aiLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'ai.question-generation.start',
          topic: 'the NATO alphabet',
        }),
        expect.any(String)
      );
    });

    it('should track timing metrics', async () => {
      const mockQuestions = {
        questions: [
          {
            question: 'Test',
            options: ['A', 'B'],
            correctAnswer: 'A',
          },
        ],
      };

      const mockTimer = {
        end: vi.fn(() => 150),
      };
      vi.mocked(loggers.time).mockReturnValue(mockTimer);
      vi.mocked(generateObject).mockResolvedValue(createMockResult(mockQuestions));

      await generateQuizWithAI('Performance Test');

      expect(loggers.time).toHaveBeenCalledWith('ai.question-generation.Performance Test', 'ai');

      expect(mockTimer.end).toHaveBeenCalledWith({
        topic: 'Performance Test',
        questionCount: 1,
        success: true,
      });

      expect(aiLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          duration: 150,
        }),
        expect.any(String)
      );
    });

    it('should handle network timeout errors and classify them correctly', async () => {
      const timeoutError = new Error('Request timeout');
      timeoutError.name = 'TimeoutError';
      vi.mocked(generateObject).mockRejectedValue(timeoutError);

      await expect(generateQuizWithAI('Timeout Test')).rejects.toThrow('Request timeout');

      // Should log the timeout error with correct classification
      expect(loggers.error).toHaveBeenCalledWith(
        timeoutError,
        'ai',
        expect.objectContaining({
          errorType: 'timeout-error',
        }),
        expect.any(String)
      );
    });

    it('should validate question structure', async () => {
      const mockQuestions = {
        questions: [
          {
            question: 'Valid question?',
            type: 'multiple-choice',
            options: ['A', 'B', 'C', 'D'],
            correctAnswer: 'A',
            explanation: 'This is the explanation',
          },
          {
            question: '', // Empty question instead of null
            options: [], // Empty array instead of null
            correctAnswer: '', // Empty string instead of null
          },
        ],
      };

      vi.mocked(generateObject).mockResolvedValue(createMockResult(mockQuestions));

      const result = await generateQuizWithAI('Validation Test');

      // Should handle invalid data gracefully
      expect(result).toHaveLength(2);

      // First question should be valid
      expect(result[0].question).toBe('Valid question?');

      // Second question should have defaults for invalid data
      expect(result[1]).toMatchObject({
        question: '',
        type: 'multiple-choice',
        options: [],
        correctAnswer: '',
      });
    });
  });
});
