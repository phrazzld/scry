import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Import after mocks
import { generateQuizWithAI } from '@/lib/ai-client';

import { POST } from './route';

// Set up environment variables BEFORE imports
process.env.NEXT_PUBLIC_CONVEX_URL = 'https://test.convex.cloud';

// Mock dependencies
vi.mock('@/lib/ai-client', () => ({
  generateQuizWithAI: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  createRequestLogger: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  })),
  loggers: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    apiRequest: vi.fn(),
    time: vi.fn(() => ({
      end: vi.fn(() => 100), // Return mock duration
    })),
  },
}));

describe('/api/generate-questions', () => {
  // Verify mocks are working
  it('should have mocked generateQuizWithAI', () => {
    expect(vi.mocked(generateQuizWithAI)).toBeDefined();
  });

  beforeEach(() => {
    vi.clearAllMocks();

    // Default successful AI generation
    vi.mocked(generateQuizWithAI).mockResolvedValue([
      {
        question: 'What is React?',
        options: ['A library', 'A framework', 'A database', 'An OS'],
        correctAnswer: 'A library',
      },
      {
        question: 'What is JSX?',
        options: ['JavaScript XML', 'JSON Extended', 'Java Syntax', 'JS Extra'],
        correctAnswer: 'JavaScript XML',
      },
    ]);
  });

  describe('Successful Question Generation', () => {
    it('should generate questions successfully with valid input', async () => {
      const request = new NextRequest('http://localhost:3000/api/generate-questions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': '192.168.1.1',
        },
        body: JSON.stringify({
          topic: 'JavaScript Basics',
          difficulty: 'medium',
        }),
      });

      let response, data;
      try {
        response = await POST(request);
        data = await response.json();
      } catch (error) {
        console.error('Error calling POST:', error);
        throw error;
      }

      // Debug if failing
      if (response.status !== 200) {
        console.error('Response status:', response.status);
        console.error('Response data:', data);
      }

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('topic', 'JavaScript Basics');
      expect(data).toHaveProperty('difficulty', 'medium');
      expect(data).toHaveProperty('questions');
      expect(data.questions).toHaveLength(2);
      expect(data.questions[0]).toHaveProperty('question', 'What is React?');
    });
  });

  describe('Input Validation', () => {
    it('should reject empty topic', async () => {
      const request = new NextRequest('http://localhost:3000/api/generate-questions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          topic: '',
          difficulty: 'medium',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toHaveProperty('error');
      expect(data.error).toMatch(/validation/i);
    });

    it('should reject invalid difficulty', async () => {
      const request = new NextRequest('http://localhost:3000/api/generate-questions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          topic: 'JavaScript',
          difficulty: 'extreme', // Invalid - should be easy/medium/hard
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toHaveProperty('error');
      expect(data.error).toMatch(/validation|difficulty/i);
    });

    it('should accept topics and trust the model', async () => {
      const request = new NextRequest('http://localhost:3000/api/generate-questions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          topic: 'the NATO alphabet', // Previously blocked by "the" prefix removal
          difficulty: 'medium',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.topic).toBe('the NATO alphabet'); // Passed through as-is
    });

    it('should reject excessively long topics', async () => {
      const longTopic = 'A'.repeat(5001); // Limit is 5000 chars

      const request = new NextRequest('http://localhost:3000/api/generate-questions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          topic: longTopic,
          difficulty: 'medium',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toHaveProperty('error');
    });
  });

  describe('Error Handling', () => {
    it('should handle generic AI generation failures', async () => {
      const error = new Error('AI service unavailable');
      error.name = 'generation-error';
      vi.mocked(generateQuizWithAI).mockRejectedValue(error);

      const request = new NextRequest('http://localhost:3000/api/generate-questions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          topic: 'JavaScript',
          difficulty: 'medium',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toHaveProperty('error');
      expect(data).toHaveProperty('errorType', 'generation-error');
      expect(data.error).toMatch(/generation failed|rephrase/i);
    });

    it('should handle API key errors with 503 status', async () => {
      const error = new Error('API key not configured');
      error.name = 'api-key-error';
      vi.mocked(generateQuizWithAI).mockRejectedValue(error);

      const request = new NextRequest('http://localhost:3000/api/generate-questions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          topic: 'Python',
          difficulty: 'easy',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(503);
      expect(data).toHaveProperty('errorType', 'api-key-error');
      expect(data.error).toMatch(/configuration|support/i);
    });

    it('should handle rate limit errors with 429 status', async () => {
      const error = new Error('Rate limit exceeded');
      error.name = 'rate-limit-error';
      vi.mocked(generateQuizWithAI).mockRejectedValue(error);

      const request = new NextRequest('http://localhost:3000/api/generate-questions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          topic: 'React',
          difficulty: 'hard',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(429);
      expect(data).toHaveProperty('errorType', 'rate-limit-error');
      expect(data.error).toMatch(/too many requests|wait/i);
    });

    it('should handle timeout errors with 504 status', async () => {
      const error = new Error('Request timed out');
      error.name = 'timeout-error';
      vi.mocked(generateQuizWithAI).mockRejectedValue(error);

      const request = new NextRequest('http://localhost:3000/api/generate-questions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          topic: 'TypeScript',
          difficulty: 'medium',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(504);
      expect(data).toHaveProperty('errorType', 'timeout-error');
      expect(data.error).toMatch(/timeout|simpler/i);
    });

    it('should handle malformed JSON body', async () => {
      const request = new NextRequest('http://localhost:3000/api/generate-questions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: 'invalid json {', // Malformed JSON
      } as unknown as Request);

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toHaveProperty('error');
      expect(data.error).toMatch(/invalid|parse|json/i);
    });

    it('should handle missing body', async () => {
      const request = new NextRequest('http://localhost:3000/api/generate-questions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toHaveProperty('error');
    });
  });

  describe('Response Structure', () => {
    it('should return consistent response structure for success', async () => {
      const request = new NextRequest('http://localhost:3000/api/generate-questions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          topic: 'Testing',
          difficulty: 'easy',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      // Verify response structure
      expect(data).toMatchObject({
        topic: 'Testing',
        difficulty: 'easy',
        questions: expect.arrayContaining([
          expect.objectContaining({
            id: expect.any(Number),
            question: expect.any(String),
            options: expect.any(Array),
            correctAnswer: expect.any(String),
          }),
        ]),
      });
    });

    it('should return consistent error structure', async () => {
      const request = new NextRequest('http://localhost:3000/api/generate-questions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          topic: '',
          difficulty: 'easy',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data).toMatchObject({
        error: expect.any(String),
        details: expect.any(Object),
      });
    });
  });

  describe('HTTP Method Validation', () => {
    it('should only export POST method', async () => {
      // Verify that only POST is exported from the route module
      const routeModule = await import('./route');

      // POST should be defined
      expect(routeModule.POST).toBeDefined();
      expect(typeof routeModule.POST).toBe('function');

      // Other methods should not be exported
      const otherMethods = ['GET', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];
      for (const method of otherMethods) {
        expect(routeModule).not.toHaveProperty(method);
      }
    });
  });
});
