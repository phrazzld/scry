import { describe, expect, it, vi } from 'vitest';
import { prepareConceptIdeas, prepareGeneratedPhrasings } from '../../convex/aiGeneration';
import { logConceptEvent, type ConceptsLogger } from '../../convex/lib/logger';

/**
 * Tests for AI generation error classification
 * Tests error categorization and retryability logic
 */

/**
 * Simulate the error classification logic from aiGeneration.ts
 */
function classifyError(error: Error): { code: string; retryable: boolean } {
  const message = error.message.toLowerCase();
  const errorName = error.name || '';

  // Schema validation errors - AI generated invalid format
  if (
    errorName.includes('AI_NoObjectGeneratedError') ||
    message.includes('schema') ||
    message.includes('validation') ||
    message.includes('does not match validator')
  ) {
    return { code: 'SCHEMA_VALIDATION', retryable: true };
  }

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

  describe('Schema Validation Errors', () => {
    it('should classify schema error correctly', () => {
      const error = new Error('Value does not match validator. Expected type: "multiple-choice"');
      const result = classifyError(error);

      expect(result.code).toBe('SCHEMA_VALIDATION');
      expect(result.retryable).toBe(true);
    });

    it('should classify AI_NoObjectGeneratedError correctly', () => {
      const error = new Error('Failed to generate object');
      error.name = 'AI_NoObjectGeneratedError';
      const result = classifyError(error);

      expect(result.code).toBe('SCHEMA_VALIDATION');
      expect(result.retryable).toBe(true);
    });

    it('should classify validation failure error correctly', () => {
      const error = new Error('Validation failed for input schema');
      const result = classifyError(error);

      expect(result.code).toBe('SCHEMA_VALIDATION');
      expect(result.retryable).toBe(true);
    });

    it('should classify "does not match validator" error correctly', () => {
      const error = new Error('ArgumentValidationError: Value does not match validator');
      const result = classifyError(error);

      expect(result.code).toBe('SCHEMA_VALIDATION');
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

    it('should mark all schema validation errors as retryable', () => {
      const errors = [
        new Error('Validation failed'),
        new Error('Schema mismatch'),
        new Error('Value does not match validator'),
      ];

      errors.forEach((error) => {
        const result = classifyError(error);
        expect(result.retryable).toBe(true);
      });
    });

    it('should mark all unknown errors as non-retryable', () => {
      const errors = [
        new Error('Generic error'),
        new Error('Internal server error'),
        new Error('Unexpected application state'),
      ];

      errors.forEach((error) => {
        const result = classifyError(error);
        expect(result.retryable).toBe(false);
      });
    });
  });
});

describe('Concept Logging', () => {
  it('logs stage completion with concept ids and correlation id', () => {
    const infoSpy = vi.fn();
    const stubLogger: ConceptsLogger = {
      info: infoSpy,
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    };

    logConceptEvent(stubLogger, 'info', 'Stage A concept synthesis completed', {
      phase: 'stage_a',
      event: 'completed',
      correlationId: 'corr-stage-a',
      conceptIds: ['concept-1', 'concept-2'],
      jobId: 'job-123',
      conceptCount: 2,
    });

    expect(infoSpy).toHaveBeenCalledTimes(1);
    const [message, context] = infoSpy.mock.calls[0];
    expect(message).toBe('Stage A concept synthesis completed');
    expect(context?.event).toBe('concepts.stage_a.completed');
    expect(context?.conceptIds).toEqual(['concept-1', 'concept-2']);
    expect(context?.correlationId).toBe('corr-stage-a');
  });
});

describe('Stage A Concept Preparation', () => {
  it('removes duplicate titles case-insensitively', () => {
    const ideas = prepareConceptIdeas([
      {
        title: 'Eucharistic Theology Foundations',
        description: 'Analyzes transubstantiation and the sacramental presence of Christ.',
        whyItMatters: 'Central to Catholic worship understanding.',
      },
      {
        title: 'eucharistic theology foundations',
        description: 'Duplicate entry that should be removed.',
        whyItMatters: 'Duplicate for testing.',
      },
      {
        title: 'Guardian Angels in Daily Life',
        description: 'Explores theological sources describing how guardian angels guide believers.',
        whyItMatters: 'Relevant to daily spiritual practice.',
      },
    ]);

    expect(ideas).toHaveLength(2);
    expect(ideas.map((c) => c.title)).toContain('Eucharistic Theology Foundations');
    expect(ideas.map((c) => c.title)).toContain('Guardian Angels in Daily Life');
  });

  it('filters multi-topic concepts that bundle comparisons', () => {
    const ideas = prepareConceptIdeas([
      {
        title: 'Grace and Free Will Debate',
        description:
          'Contrast Augustine vs Pelagius, outline both views, contrast them, and explain how the Council of Orange mediates between them.',
        whyItMatters: 'Fundamental theological controversy in Church history.',
      },
      {
        title: "Pascal's Wager Motivation",
        description:
          "Explain the intuition behind Pascal's Wager and why it influenced apologetics.",
        whyItMatters: 'Key apologetic argument for faith.',
      },
    ]);

    expect(ideas).toHaveLength(1);
    expect(ideas[0].title).toBe("Pascal's Wager Motivation");
  });

  it('caps the number of accepted concepts', () => {
    const bulkIdeas = Array.from({ length: 10 }).map((_, index) => ({
      title: `Concept ${index + 1}`,
      description: `Detailed standalone explanation number ${index + 1} covering a single learning objective about topic ${index}.`,
      whyItMatters: `Important for understanding topic ${index}.`,
    }));

    const ideas = prepareConceptIdeas(bulkIdeas);
    expect(ideas.length).toBeLessThanOrEqual(6);
  });

  it('filters concepts with descriptions that are too short', () => {
    const ideas = prepareConceptIdeas([
      {
        title: 'Insufficient Detail Concept',
        description: 'Barely says anything at all.',
        whyItMatters: 'Should be filtered out.',
      },
      {
        title: 'Rich Eucharistic Symbolism',
        description:
          'Explains how each eucharistic symbol reinforces Christological teaching and why the faithful revisit them weekly.',
        whyItMatters: 'Essential for liturgical understanding.',
      },
    ]);

    expect(ideas).toHaveLength(1);
    expect(ideas[0].title).toBe('Rich Eucharistic Symbolism');
  });

  it('rejects conjunction-heavy proposals that bundle multiple ideas', () => {
    const ideas = prepareConceptIdeas([
      {
        title: 'Grace, Merit, and Cooperation',
        description:
          'Define sanctifying grace and habitual grace and actual grace and then connect each to merit and synergy.',
        whyItMatters: 'Foundational for understanding salvation theology.',
      },
      {
        title: 'Single Doctrine Focus',
        description:
          'Describes how Augustine frames grace as both gift and ongoing invitation, highlighting a single retrievable unit.',
        whyItMatters: 'Core Augustinian teaching on grace.',
      },
    ]);

    expect(ideas).toHaveLength(1);
    expect(ideas[0].title).toBe('Single Doctrine Focus');
  });

  it('returns empty array when every proposed concept violates heuristics', () => {
    const ideas = prepareConceptIdeas([
      {
        title: 'Short One',
        description: 'Tiny.',
        whyItMatters: 'Too short.',
      },
      {
        title: 'Comparison Bundle',
        description:
          'Contrast Peter vs Paul vs Barnabas across missionary journeys and doctrinal disputes and liturgical leadership.',
        whyItMatters: 'Understanding apostolic leadership.',
      },
    ]);

    expect(ideas).toEqual([]);
  });
});

describe('Stage B Phrasing Preparation', () => {
  it('filters duplicate or short phrasings', () => {
    const phrasings = prepareGeneratedPhrasings(
      [
        {
          question: 'What is the primary symbolism of Baptismal water?',
          explanation: 'Explains cleansing from sin and participation in Christ.',
          type: 'multiple-choice',
          options: ['New birth', 'Forgiveness', 'Cleansing', 'All of the above'],
          correctAnswer: 'All of the above',
        },
        {
          question: 'What is the primary symbolism of Baptismal water?',
          explanation: 'Duplicate question should be filtered out.',
          type: 'multiple-choice',
          options: ['Grace', 'Faith', 'Hope', 'Love'],
          correctAnswer: 'Grace',
        },
        {
          question: 'Short?',
          explanation: 'Too short question should be removed.',
          type: 'true-false',
          options: ['True', 'False'],
          correctAnswer: 'True',
        },
      ],
      [],
      4
    );

    expect(phrasings).toHaveLength(1);
    expect(phrasings[0].question).toContain('Baptismal water');
  });

  it('normalizes correct answers for multiple choice', () => {
    const phrasings = prepareGeneratedPhrasings(
      [
        {
          question: 'Which gospel contains the Beatitudes?',
          explanation: 'Checks knowledge of Matthew 5.',
          type: 'multiple-choice',
          options: ['Mark', 'john', 'Matthew', 'Luke'],
          correctAnswer: 'matthew',
        },
      ],
      [],
      3
    );

    expect(phrasings[0].correctAnswer).toBe('Matthew');
  });
});
