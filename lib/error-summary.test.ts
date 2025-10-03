import { describe, expect, it } from 'vitest';

import { formatErrorDetails, getErrorSummary } from './error-summary';

describe('getErrorSummary', () => {
  describe('Error Code Classification', () => {
    it('should provide user-friendly message for SCHEMA_VALIDATION error', () => {
      const result = getErrorSummary(
        'ArgumentValidationError: Value does not match...',
        'SCHEMA_VALIDATION'
      );

      expect(result.summary).toBe('Invalid format. The AI returned unexpected data.');
      expect(result.hasDetails).toBe(true);
    });

    it('should provide user-friendly message for RATE_LIMIT error', () => {
      const result = getErrorSummary('Rate limit exceeded', 'RATE_LIMIT');

      expect(result.summary).toBe('Rate limit reached. Please wait a moment.');
      expect(result.hasDetails).toBe(false);
    });

    it('should provide user-friendly message for API_KEY error', () => {
      const result = getErrorSummary('Invalid API key', 'API_KEY');

      expect(result.summary).toBe('API configuration error. Please contact support.');
      expect(result.hasDetails).toBe(true);
    });

    it('should provide user-friendly message for NETWORK error', () => {
      const result = getErrorSummary('Connection timeout', 'NETWORK');

      expect(result.summary).toBe('Network error. Please check your connection.');
      expect(result.hasDetails).toBe(false);
    });
  });

  describe('Long Error Truncation', () => {
    it('should truncate errors longer than 80 characters', () => {
      const longError = 'A'.repeat(100);
      const result = getErrorSummary(longError);

      expect(result.summary.length).toBe(80);
      expect(result.summary).toContain('...');
      expect(result.hasDetails).toBe(true);
    });

    it('should not truncate errors exactly 80 characters', () => {
      const exactError = 'A'.repeat(80);
      const result = getErrorSummary(exactError);

      expect(result.summary).toBe(exactError);
      expect(result.hasDetails).toBe(false);
    });

    it('should not truncate errors shorter than 80 characters', () => {
      const shortError = 'Short error message';
      const result = getErrorSummary(shortError);

      expect(result.summary).toBe(shortError);
      expect(result.hasDetails).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing error message', () => {
      const result = getErrorSummary(undefined);

      expect(result.summary).toBe('An unknown error occurred.');
      expect(result.hasDetails).toBe(false);
    });

    it('should handle empty error message', () => {
      const result = getErrorSummary('');

      expect(result.summary).toBe('An unknown error occurred.');
      expect(result.hasDetails).toBe(false);
    });

    it('should handle error with no error code', () => {
      const result = getErrorSummary('Some generic error');

      expect(result.summary).toBe('Some generic error');
      expect(result.hasDetails).toBe(false);
    });

    it('should handle unknown error code', () => {
      const result = getErrorSummary('Error message', 'UNKNOWN_CODE');

      expect(result.summary).toBe('Error message');
      expect(result.hasDetails).toBe(false);
    });
  });

  describe('Real-World Scenarios', () => {
    it('should handle actual ArgumentValidationError from screenshot', () => {
      const actualError = `ArgumentValidationError: Value does not match validator. Path: .questions[0].type Value: "multiple" Validator: v.union(v.literal("multiple-choice"), v.literal("true-false"))`;
      const result = getErrorSummary(actualError, 'SCHEMA_VALIDATION');

      expect(result.summary).toBe('Invalid format. The AI returned unexpected data.');
      expect(result.hasDetails).toBe(true);
    });

    it('should handle very long complex error messages', () => {
      const complexError = `Method doesn't allow unregistered callers (callers without established identity). Please use API Key or other form of API consumer identity to call this API. at async handler (/Users/phaedrus/Development/scry/convex/generationJobs.ts:285:12)`;
      const result = getErrorSummary(complexError);

      expect(result.summary.length).toBe(80);
      expect(result.summary).toContain('...');
      expect(result.hasDetails).toBe(true);
    });
  });
});

describe('formatErrorDetails', () => {
  it('should format error with code', () => {
    const result = formatErrorDetails('Something went wrong', 'SCHEMA_VALIDATION');

    expect(result).toBe('Error Code: SCHEMA_VALIDATION\n\nSomething went wrong');
  });

  it('should format error without code', () => {
    const result = formatErrorDetails('Something went wrong');

    expect(result).toBe('Something went wrong');
  });

  it('should handle missing error message', () => {
    const result = formatErrorDetails(undefined, 'TEST_CODE');

    expect(result).toBe('Error Code: TEST_CODE\n\nNo error details available.');
  });

  it('should handle completely missing data', () => {
    const result = formatErrorDetails();

    expect(result).toBe('No error details available.');
  });
});
