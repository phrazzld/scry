import { describe, expect, it } from 'vitest';

/**
 * Tests for AI generation error classification
 * Tests error categorization and retryability logic
 */

/**
 * Simulate the error classification logic from aiGeneration.ts
 */
function classifyError(error: Error): { code: string; retryable: boolean } {
  const message = error.message.toLowerCase();

  // Rate limit errors are transient and retryable
  if (message.includes('rate limit') || message.includes('429') || message.includes('quota')) {
    return { code: 'RATE_LIMIT', retryable: true };
  }

  // API key errors are permanent and not retryable
  if (message.includes('api key') || message.includes('401') || message.includes('unauthorized')) {
    return { code: 'API_KEY', retryable: false };
  }

  // Network/timeout errors are transient and retryable
  if (message.includes('network') || message.includes('timeout') || message.includes('etimedout')) {
    return { code: 'NETWORK', retryable: true };
  }

  // Unknown errors are treated as non-retryable by default
  return { code: 'UNKNOWN', retryable: false };
}

describe('AI Generation - Error Classification', () => {
  describe('Rate Limit Errors', () => {
    it('should classify "rate limit" error correctly', () => {
      const error = new Error('Rate limit exceeded. Please try again later.');
      const result = classifyError(error);

      expect(result.code).toBe('RATE_LIMIT');
      expect(result.retryable).toBe(true);
    });

    it('should classify "RATE LIMIT" error with caps correctly', () => {
      const error = new Error('RATE LIMIT EXCEEDED');
      const result = classifyError(error);

      expect(result.code).toBe('RATE_LIMIT');
      expect(result.retryable).toBe(true);
    });

    it('should classify 429 status code error correctly', () => {
      const error = new Error('HTTP 429: Too Many Requests');
      const result = classifyError(error);

      expect(result.code).toBe('RATE_LIMIT');
      expect(result.retryable).toBe(true);
    });

    it('should classify quota exceeded error correctly', () => {
      const error = new Error('Quota exceeded for this resource');
      const result = classifyError(error);

      expect(result.code).toBe('RATE_LIMIT');
      expect(result.retryable).toBe(true);
    });

    it('should classify mixed case quota error correctly', () => {
      const error = new Error('Your QUOTA has been exceeded');
      const result = classifyError(error);

      expect(result.code).toBe('RATE_LIMIT');
      expect(result.retryable).toBe(true);
    });
  });

  describe('API Key Errors', () => {
    it('should classify "api key" error correctly', () => {
      const error = new Error('Invalid API key provided');
      const result = classifyError(error);

      expect(result.code).toBe('API_KEY');
      expect(result.retryable).toBe(false);
    });

    it('should classify "API KEY" error with caps correctly', () => {
      const error = new Error('API KEY is invalid or missing');
      const result = classifyError(error);

      expect(result.code).toBe('API_KEY');
      expect(result.retryable).toBe(false);
    });

    it('should classify 401 status code error correctly', () => {
      const error = new Error('HTTP 401: Unauthorized access');
      const result = classifyError(error);

      expect(result.code).toBe('API_KEY');
      expect(result.retryable).toBe(false);
    });

    it('should classify "unauthorized" error correctly', () => {
      const error = new Error('Unauthorized: Please check your credentials');
      const result = classifyError(error);

      expect(result.code).toBe('API_KEY');
      expect(result.retryable).toBe(false);
    });

    it('should classify mixed case unauthorized error correctly', () => {
      const error = new Error('Request is UNAUTHORIZED');
      const result = classifyError(error);

      expect(result.code).toBe('API_KEY');
      expect(result.retryable).toBe(false);
    });
  });

  describe('Network Errors', () => {
    it('should classify "network" error correctly', () => {
      const error = new Error('Network error occurred');
      const result = classifyError(error);

      expect(result.code).toBe('NETWORK');
      expect(result.retryable).toBe(true);
    });

    it('should classify "NETWORK" error with caps correctly', () => {
      const error = new Error('NETWORK connection failed');
      const result = classifyError(error);

      expect(result.code).toBe('NETWORK');
      expect(result.retryable).toBe(true);
    });

    it('should classify "timeout" error correctly', () => {
      const error = new Error('Request timeout after 30 seconds');
      const result = classifyError(error);

      expect(result.code).toBe('NETWORK');
      expect(result.retryable).toBe(true);
    });

    it('should classify "TIMEOUT" error with caps correctly', () => {
      const error = new Error('Connection TIMEOUT');
      const result = classifyError(error);

      expect(result.code).toBe('NETWORK');
      expect(result.retryable).toBe(true);
    });

    it('should classify "ETIMEDOUT" error correctly', () => {
      const error = new Error('ETIMEDOUT: Connection timed out');
      const result = classifyError(error);

      expect(result.code).toBe('NETWORK');
      expect(result.retryable).toBe(true);
    });

    it('should classify lowercase "etimedout" error correctly', () => {
      const error = new Error('etimedout - failed to connect');
      const result = classifyError(error);

      expect(result.code).toBe('NETWORK');
      expect(result.retryable).toBe(true);
    });
  });

  describe('Unknown Errors', () => {
    it('should classify generic error as UNKNOWN', () => {
      const error = new Error('Something went wrong');
      const result = classifyError(error);

      expect(result.code).toBe('UNKNOWN');
      expect(result.retryable).toBe(false);
    });

    it('should classify validation error as UNKNOWN', () => {
      const error = new Error('Validation failed for input schema');
      const result = classifyError(error);

      expect(result.code).toBe('UNKNOWN');
      expect(result.retryable).toBe(false);
    });

    it('should classify internal server error as UNKNOWN', () => {
      const error = new Error('Internal server error (500)');
      const result = classifyError(error);

      expect(result.code).toBe('UNKNOWN');
      expect(result.retryable).toBe(false);
    });

    it('should classify empty error message as UNKNOWN', () => {
      const error = new Error('');
      const result = classifyError(error);

      expect(result.code).toBe('UNKNOWN');
      expect(result.retryable).toBe(false);
    });

    it('should default non-retryable for unknown errors', () => {
      const error = new Error('Unexpected application state');
      const result = classifyError(error);

      expect(result.retryable).toBe(false);
    });
  });

  describe('Edge Cases and Priority', () => {
    it('should prioritize rate limit over other keywords', () => {
      // If error message contains multiple keywords, rate limit is checked first
      const error = new Error('rate limit exceeded and network timeout');
      const result = classifyError(error);

      expect(result.code).toBe('RATE_LIMIT');
      expect(result.retryable).toBe(true);
    });

    it('should prioritize API key over network keywords', () => {
      // API key check comes before network check
      const error = new Error('Unauthorized api key and network error');
      const result = classifyError(error);

      expect(result.code).toBe('API_KEY');
      expect(result.retryable).toBe(false);
    });

    it('should handle error message with leading/trailing spaces', () => {
      const error = new Error('   rate limit exceeded   ');
      const result = classifyError(error);

      expect(result.code).toBe('RATE_LIMIT');
      expect(result.retryable).toBe(true);
    });

    it('should handle error message in context', () => {
      const error = new Error('Error occurred: rate limit exceeded. Please retry.');
      const result = classifyError(error);

      expect(result.code).toBe('RATE_LIMIT');
      expect(result.retryable).toBe(true);
    });
  });

  describe('Real-World Error Messages', () => {
    it('should classify Google AI rate limit error', () => {
      const error = new Error(
        '[GoogleGenerativeAI Error]: Error fetching from https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent: [429 Too Many Requests] Resource has been exhausted (e.g. check quota).'
      );
      const result = classifyError(error);

      expect(result.code).toBe('RATE_LIMIT');
      expect(result.retryable).toBe(true);
    });

    it('should classify Google AI invalid key error', () => {
      const error = new Error(
        '[GoogleGenerativeAI Error]: Error fetching from https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent: [401 Unauthorized] API key not valid.'
      );
      const result = classifyError(error);

      expect(result.code).toBe('API_KEY');
      expect(result.retryable).toBe(false);
    });

    it('should classify network connection error', () => {
      const error = new Error('fetch failed: ETIMEDOUT - Connection timed out');
      const result = classifyError(error);

      expect(result.code).toBe('NETWORK');
      expect(result.retryable).toBe(true);
    });

    it('should classify DNS resolution error', () => {
      const error = new Error('getaddrinfo ENOTFOUND generativelanguage.googleapis.com');
      const result = classifyError(error);

      // DNS errors don't match any keyword, should be UNKNOWN
      expect(result.code).toBe('UNKNOWN');
      expect(result.retryable).toBe(false);
    });

    it('should classify JSON parsing error', () => {
      const error = new Error('Unexpected token < in JSON at position 0');
      const result = classifyError(error);

      expect(result.code).toBe('UNKNOWN');
      expect(result.retryable).toBe(false);
    });
  });

  describe('Retryability Rules', () => {
    it('should mark all rate limit errors as retryable', () => {
      const errors = [
        new Error('Rate limit exceeded'),
        new Error('HTTP 429'),
        new Error('Quota exceeded'),
      ];

      errors.forEach((error) => {
        const result = classifyError(error);
        expect(result.retryable).toBe(true);
      });
    });

    it('should mark all API key errors as non-retryable', () => {
      const errors = [
        new Error('Invalid API key'),
        new Error('HTTP 401'),
        new Error('Unauthorized access'),
      ];

      errors.forEach((error) => {
        const result = classifyError(error);
        expect(result.retryable).toBe(false);
      });
    });

    it('should mark all network errors as retryable', () => {
      const errors = [
        new Error('Network error'),
        new Error('Request timeout'),
        new Error('ETIMEDOUT'),
      ];

      errors.forEach((error) => {
        const result = classifyError(error);
        expect(result.retryable).toBe(true);
      });
    });

    it('should mark all unknown errors as non-retryable', () => {
      const errors = [
        new Error('Generic error'),
        new Error('Validation failed'),
        new Error('Internal server error'),
      ];

      errors.forEach((error) => {
        const result = classifyError(error);
        expect(result.retryable).toBe(false);
      });
    });
  });
});
