import { describe, it, expect, vi, beforeEach } from 'vitest'
import { generateQuizWithAI } from './ai-client'

// Mock dependencies
vi.mock('@ai-sdk/google', () => ({
  createGoogleGenerativeAI: vi.fn(() => vi.fn())
}))

vi.mock('ai', () => ({
  generateObject: vi.fn()
}))

vi.mock('./logger', () => ({
  aiLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  },
  loggers: {
    error: vi.fn(),
    time: vi.fn(() => ({
      end: vi.fn(() => 100)
    }))
  }
}))

vi.mock('./prompt-sanitization', () => ({
  createSafePrompt: vi.fn((topic: string) => `Generate questions about ${topic}`),
  sanitizeTopic: vi.fn((topic: string) => topic.trim())
}))

import { generateObject } from 'ai'
import { createSafePrompt, sanitizeTopic } from './prompt-sanitization'
import { aiLogger, loggers } from './logger'

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
    toJsonResponse: () => new Response(JSON.stringify(object))
  }
}

describe('AI Client', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset env var
    process.env.GOOGLE_AI_API_KEY = 'test-api-key'
  })

  describe('generateQuizWithAI', () => {
    it('should generate questions successfully', async () => {
      const mockQuestions = {
        questions: [
          {
            question: 'What is JavaScript?',
            type: 'multiple-choice',
            options: ['A programming language', 'A database', 'An OS', 'A framework'],
            correctAnswer: 'A programming language',
            explanation: 'JavaScript is a programming language used for web development'
          },
          {
            question: 'JavaScript is dynamically typed',
            type: 'true-false',
            options: ['True', 'False'],
            correctAnswer: 'True',
            explanation: 'JavaScript uses dynamic typing'
          }
        ]
      }

      vi.mocked(generateObject).mockResolvedValue(createMockResult(mockQuestions))

      const result = await generateQuizWithAI('JavaScript')

      expect(result).toHaveLength(2)
      expect(result[0]).toMatchObject({
        question: 'What is JavaScript?',
        type: 'multiple-choice',
        options: expect.arrayContaining(['A programming language']),
        correctAnswer: 'A programming language'
      })

      // Verify sanitization was called
      expect(sanitizeTopic).toHaveBeenCalledWith('JavaScript')
      expect(createSafePrompt).toHaveBeenCalledWith('JavaScript')

      // Verify logging
      expect(aiLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'ai.question-generation.start',
          topic: 'JavaScript'
        }),
        expect.any(String)
      )
    })

    it('should handle questions with missing optional fields', async () => {
      const mockQuestions = {
        questions: [
          {
            question: 'Test question?',
            options: ['A', 'B'],
            correctAnswer: 'A'
            // No type or explanation
          }
        ]
      }

      vi.mocked(generateObject).mockResolvedValue(createMockResult(mockQuestions))

      const result = await generateQuizWithAI('Test Topic')

      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({
        question: 'Test question?',
        type: 'multiple-choice', // Should default to multiple-choice
        options: ['A', 'B'],
        correctAnswer: 'A',
        explanation: undefined
      })
    })

    it('should return fallback questions on AI generation failure', async () => {
      const error = new Error('AI service unavailable')
      vi.mocked(generateObject).mockRejectedValue(error)

      const result = await generateQuizWithAI('Mathematics')

      // Should return 2 fallback questions
      expect(result).toHaveLength(2)
      
      // Check first fallback question
      expect(result[0]).toMatchObject({
        question: 'What is Mathematics?',
        type: 'multiple-choice',
        options: expect.arrayContaining(['Option A', 'Option B']),
        correctAnswer: 'Option A'
      })

      // Check second fallback question
      expect(result[1]).toMatchObject({
        question: 'Mathematics is an important subject to study.',
        type: 'true-false',
        options: ['True', 'False'],
        correctAnswer: 'True'
      })

      // Verify error logging
      expect(loggers.error).toHaveBeenCalledWith(
        error,
        'ai',
        expect.objectContaining({
          event: 'ai.question-generation.failure',
          topic: 'Mathematics'
        }),
        'Failed to generate questions: AI service unavailable'
      )

      expect(aiLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'ai.question-generation.fallback',
          topic: 'Mathematics'
        }),
        expect.stringContaining('Using fallback questions')
      )
    })

    it('should handle empty response from AI', async () => {
      const mockQuestions = {
        questions: []
      }

      vi.mocked(generateObject).mockResolvedValue(createMockResult(mockQuestions))

      const result = await generateQuizWithAI('Empty Topic')

      expect(result).toEqual([])
      expect(result).toHaveLength(0)
    })

    it('should log different topic when sanitization changes it', async () => {
      const mockQuestions = {
        questions: [
          {
            question: 'Test',
            options: ['A', 'B'],
            correctAnswer: 'A'
          }
        ]
      }

      vi.mocked(generateObject).mockResolvedValue(createMockResult(mockQuestions))
      vi.mocked(sanitizeTopic).mockReturnValue('sanitized-topic')

      await generateQuizWithAI('  Unsafe <script> Topic  ')

      expect(aiLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'ai.question-generation.start',
          topic: 'sanitized-topic',
          originalTopic: '  Unsafe <script> Topic  '
        }),
        expect.any(String)
      )
    })

    it('should track timing metrics', async () => {
      const mockQuestions = {
        questions: [
          {
            question: 'Test',
            options: ['A', 'B'],
            correctAnswer: 'A'
          }
        ]
      }

      const mockTimer = {
        end: vi.fn(() => 150)
      }
      vi.mocked(loggers.time).mockReturnValue(mockTimer)
      vi.mocked(generateObject).mockResolvedValue(createMockResult(mockQuestions))
      vi.mocked(sanitizeTopic).mockReturnValue('Performance Test') // Reset mock to return exact topic

      await generateQuizWithAI('Performance Test')

      expect(loggers.time).toHaveBeenCalledWith(
        'ai.question-generation.Performance Test',
        'ai'
      )

      expect(mockTimer.end).toHaveBeenCalledWith({
        topic: 'Performance Test',
        questionCount: 1,
        success: true
      })

      expect(aiLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          duration: 150
        }),
        expect.any(String)
      )
    })

    it('should handle network timeout errors gracefully', async () => {
      const timeoutError = new Error('Request timeout')
      timeoutError.name = 'TimeoutError'
      vi.mocked(generateObject).mockRejectedValue(timeoutError)
      vi.mocked(sanitizeTopic).mockReturnValue('Timeout Test') // Reset mock to return exact topic

      const result = await generateQuizWithAI('Timeout Test')

      // Should return fallback questions
      expect(result).toHaveLength(2)
      expect(result[0].question).toContain('Timeout Test')

      // Should log the timeout error
      expect(loggers.error).toHaveBeenCalledWith(
        timeoutError,
        'ai',
        expect.any(Object),
        expect.any(String)
      )
    })

    it('should validate question structure', async () => {
      const mockQuestions = {
        questions: [
          {
            question: 'Valid question?',
            type: 'multiple-choice',
            options: ['A', 'B', 'C', 'D'],
            correctAnswer: 'A',
            explanation: 'This is the explanation'
          },
          {
            question: '',  // Empty question instead of null
            options: [],  // Empty array instead of null
            correctAnswer: ''  // Empty string instead of null
          }
        ]
      }

      vi.mocked(generateObject).mockResolvedValue(createMockResult(mockQuestions))

      const result = await generateQuizWithAI('Validation Test')

      // Should handle invalid data gracefully
      expect(result).toHaveLength(2)
      
      // First question should be valid
      expect(result[0].question).toBe('Valid question?')
      
      // Second question should have defaults for invalid data
      expect(result[1]).toMatchObject({
        question: '',
        type: 'multiple-choice',
        options: [],
        correctAnswer: ''
      })
    })
  })
})