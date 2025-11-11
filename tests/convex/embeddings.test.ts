import { describe, expect, it } from 'vitest';
import type { Id } from '../../convex/_generated/dataModel';
import { enforcePerUserLimit } from '../../convex/embeddings';
import { chunkArray } from '../../convex/lib/chunkArray';

/**
 * Tests for embeddings module helper functions
 *
 * Tests pure logic functions that don't require Convex runtime context:
 * - mergeSearchResults: Hybrid search result merging and deduplication
 * - chunkArray: Batch processing helper
 */

/**
 * Type for search results (copied from embeddings.ts for testing)
 */
type SearchResult = {
  _id: Id<'questions'>;
  _score: number;
  [key: string]: unknown;
};

/**
 * Merge vector search and text search results
 * (Extracted from embeddings.ts for testing)
 */
function mergeSearchResults(
  vectorResults: SearchResult[],
  textResults: unknown[],
  limit: number
): SearchResult[] {
  const seen = new Set<string>();
  const merged: SearchResult[] = [];

  // Add vector results first (semantic similarity - usually more relevant)
  for (const result of vectorResults) {
    const id = result._id.toString();
    if (!seen.has(id)) {
      seen.add(id);
      merged.push(result);
    }
  }

  // Add text results that aren't duplicates
  // Assign default score of 0.5 to text-only matches (between low/high vector scores)
  for (const result of textResults) {
    const typedResult = result as { _id: Id<'questions'>; [key: string]: unknown };
    const id = typedResult._id.toString();
    if (!seen.has(id)) {
      seen.add(id);
      merged.push({
        ...typedResult,
        _score: 0.5, // Default score for keyword matches
      } as SearchResult);
    }
  }

  // Sort by score descending and take top N
  return merged.sort((a, b) => b._score - a._score).slice(0, limit);
}

/**
 * Helper to create mock search result
 */
function createMockResult(id: string, score: number, question: string): SearchResult {
  return {
    _id: id as Id<'questions'>,
    _score: score,
    question,
  };
}

describe('Embeddings Module - mergeSearchResults', () => {
  describe('Deduplication', () => {
    it('should deduplicate results by _id', () => {
      const vectorResults: SearchResult[] = [
        createMockResult('q1', 0.9, 'React hooks'),
        createMockResult('q2', 0.8, 'Vue composition'),
      ];

      const textResults = [
        { _id: 'q1', question: 'React hooks' }, // Duplicate of vector result
        { _id: 'q3', question: 'Angular signals' },
      ];

      const merged = mergeSearchResults(vectorResults, textResults, 10);

      expect(merged.length).toBe(3);
      const ids = merged.map((r) => r._id);
      expect(ids).toEqual(['q1', 'q2', 'q3']);
    });

    it('should prioritize vector results over text results for duplicates', () => {
      const vectorResults: SearchResult[] = [createMockResult('q1', 0.9, 'React hooks')];

      const textResults = [{ _id: 'q1', question: 'React hooks different' }];

      const merged = mergeSearchResults(vectorResults, textResults, 10);

      expect(merged.length).toBe(1);
      expect(merged[0]._score).toBe(0.9); // Vector score, not text default 0.5
      expect(merged[0].question).toBe('React hooks'); // Vector result data
    });

    it('should handle empty vector results', () => {
      const vectorResults: SearchResult[] = [];
      const textResults = [
        { _id: 'q1', question: 'Text only 1' },
        { _id: 'q2', question: 'Text only 2' },
      ];

      const merged = mergeSearchResults(vectorResults, textResults, 10);

      expect(merged.length).toBe(2);
      expect(merged[0]._score).toBe(0.5);
      expect(merged[1]._score).toBe(0.5);
    });

    it('should handle empty text results', () => {
      const vectorResults: SearchResult[] = [
        createMockResult('q1', 0.9, 'Vector only 1'),
        createMockResult('q2', 0.8, 'Vector only 2'),
      ];
      const textResults: unknown[] = [];

      const merged = mergeSearchResults(vectorResults, textResults, 10);

      expect(merged.length).toBe(2);
      expect(merged[0]._score).toBe(0.9);
      expect(merged[1]._score).toBe(0.8);
    });

    it('should handle both empty arrays', () => {
      const vectorResults: SearchResult[] = [];
      const textResults: unknown[] = [];

      const merged = mergeSearchResults(vectorResults, textResults, 10);

      expect(merged.length).toBe(0);
    });
  });

  describe('Scoring', () => {
    it('should assign default score 0.5 to text-only results', () => {
      const vectorResults: SearchResult[] = [];
      const textResults = [
        { _id: 'q1', question: 'Text result 1' },
        { _id: 'q2', question: 'Text result 2' },
      ];

      const merged = mergeSearchResults(vectorResults, textResults, 10);

      expect(merged.length).toBe(2);
      expect(merged[0]._score).toBe(0.5);
      expect(merged[1]._score).toBe(0.5);
    });

    it('should preserve vector result scores', () => {
      const vectorResults: SearchResult[] = [
        createMockResult('q1', 0.95, 'High score'),
        createMockResult('q2', 0.75, 'Medium score'),
        createMockResult('q3', 0.55, 'Low score'),
      ];
      const textResults: unknown[] = [];

      const merged = mergeSearchResults(vectorResults, textResults, 10);

      expect(merged[0]._score).toBe(0.95);
      expect(merged[1]._score).toBe(0.75);
      expect(merged[2]._score).toBe(0.55);
    });
  });

  describe('Sorting and Limiting', () => {
    it('should sort results by score descending', () => {
      const vectorResults: SearchResult[] = [
        createMockResult('q1', 0.6, 'Low vector'),
        createMockResult('q2', 0.9, 'High vector'),
      ];

      const textResults = [
        { _id: 'q3', question: 'Text result' }, // Gets 0.5 score
      ];

      const merged = mergeSearchResults(vectorResults, textResults, 10);

      expect(merged.length).toBe(3);
      expect(merged[0]._id).toBe('q2'); // 0.9 score
      expect(merged[1]._id).toBe('q1'); // 0.6 score
      expect(merged[2]._id).toBe('q3'); // 0.5 score
    });

    it('should respect limit parameter', () => {
      const vectorResults: SearchResult[] = [
        createMockResult('q1', 0.9, 'Result 1'),
        createMockResult('q2', 0.8, 'Result 2'),
        createMockResult('q3', 0.7, 'Result 3'),
      ];

      const textResults = [
        { _id: 'q4', question: 'Result 4' },
        { _id: 'q5', question: 'Result 5' },
      ];

      const merged = mergeSearchResults(vectorResults, textResults, 3);

      expect(merged.length).toBe(3);
      expect(merged[0]._id).toBe('q1'); // Highest scores
      expect(merged[1]._id).toBe('q2');
      expect(merged[2]._id).toBe('q3');
      // q4 and q5 excluded by limit
    });

    it('should handle limit larger than result count', () => {
      const vectorResults: SearchResult[] = [createMockResult('q1', 0.9, 'Only result')];
      const textResults: unknown[] = [];

      const merged = mergeSearchResults(vectorResults, textResults, 100);

      expect(merged.length).toBe(1);
    });

    it('should handle limit of 0', () => {
      const vectorResults: SearchResult[] = [createMockResult('q1', 0.9, 'Result')];
      const textResults: unknown[] = [];

      const merged = mergeSearchResults(vectorResults, textResults, 0);

      expect(merged.length).toBe(0);
    });
  });

  describe('Hybrid Search Scenarios', () => {
    it('should interleave vector and text results by score', () => {
      const vectorResults: SearchResult[] = [
        createMockResult('v1', 0.9, 'High vector'),
        createMockResult('v2', 0.4, 'Low vector'),
      ];

      const textResults = [
        { _id: 't1', question: 'Text result 1' }, // Gets 0.5 score
        { _id: 't2', question: 'Text result 2' }, // Gets 0.5 score
      ];

      const merged = mergeSearchResults(vectorResults, textResults, 10);

      expect(merged.length).toBe(4);
      expect(merged[0]._id).toBe('v1'); // 0.9
      expect(merged[1]._id).toBe('t1'); // 0.5
      expect(merged[2]._id).toBe('t2'); // 0.5
      expect(merged[3]._id).toBe('v2'); // 0.4
    });

    it('should handle mixed scores correctly', () => {
      const vectorResults: SearchResult[] = [
        createMockResult('v1', 0.95, 'Very high'),
        createMockResult('v2', 0.65, 'Medium-high'),
        createMockResult('v3', 0.35, 'Low'),
      ];

      const textResults = [
        { _id: 't1', question: 'Text 1' }, // 0.5
        { _id: 't2', question: 'Text 2' }, // 0.5
      ];

      const merged = mergeSearchResults(vectorResults, textResults, 10);

      // Expected order: v1(0.95), v2(0.65), t1(0.5), t2(0.5), v3(0.35)
      expect(merged[0]._id).toBe('v1');
      expect(merged[1]._id).toBe('v2');
      expect(merged[2]._id).toBe('t1');
      expect(merged[3]._id).toBe('t2');
      expect(merged[4]._id).toBe('v3');
    });
  });
});

describe('Embeddings Module - chunkArray', () => {
  describe('Basic Chunking', () => {
    it('should chunk array into specified size', () => {
      const array = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const chunks = chunkArray(array, 3);

      expect(chunks.length).toBe(4);
      expect(chunks[0]).toEqual([1, 2, 3]);
      expect(chunks[1]).toEqual([4, 5, 6]);
      expect(chunks[2]).toEqual([7, 8, 9]);
      expect(chunks[3]).toEqual([10]); // Last chunk smaller
    });

    it('should handle array evenly divisible by chunk size', () => {
      const array = [1, 2, 3, 4, 5, 6];
      const chunks = chunkArray(array, 2);

      expect(chunks.length).toBe(3);
      expect(chunks[0]).toEqual([1, 2]);
      expect(chunks[1]).toEqual([3, 4]);
      expect(chunks[2]).toEqual([5, 6]);
    });

    it('should handle chunk size larger than array', () => {
      const array = [1, 2, 3];
      const chunks = chunkArray(array, 10);

      expect(chunks.length).toBe(1);
      expect(chunks[0]).toEqual([1, 2, 3]);
    });

    it('should handle chunk size equal to array length', () => {
      const array = [1, 2, 3, 4, 5];
      const chunks = chunkArray(array, 5);

      expect(chunks.length).toBe(1);
      expect(chunks[0]).toEqual([1, 2, 3, 4, 5]);
    });

    it('should handle chunk size of 1', () => {
      const array = [1, 2, 3];
      const chunks = chunkArray(array, 1);

      expect(chunks.length).toBe(3);
      expect(chunks[0]).toEqual([1]);
      expect(chunks[1]).toEqual([2]);
      expect(chunks[2]).toEqual([3]);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty array', () => {
      const array: number[] = [];
      const chunks = chunkArray(array, 5);

      expect(chunks.length).toBe(0);
      expect(chunks).toEqual([]);
    });

    it('should preserve object references', () => {
      const obj1 = { id: 1 };
      const obj2 = { id: 2 };
      const obj3 = { id: 3 };
      const array = [obj1, obj2, obj3];

      const chunks = chunkArray(array, 2);

      expect(chunks[0][0]).toBe(obj1); // Same reference
      expect(chunks[0][1]).toBe(obj2);
      expect(chunks[1][0]).toBe(obj3);
    });

    it('should work with different types', () => {
      const strings = ['a', 'b', 'c', 'd', 'e'];
      const chunks = chunkArray(strings, 2);

      expect(chunks.length).toBe(3);
      expect(chunks[0]).toEqual(['a', 'b']);
      expect(chunks[1]).toEqual(['c', 'd']);
      expect(chunks[2]).toEqual(['e']);
    });
  });

  describe('Use Cases', () => {
    it('should chunk 100 items into batches of 10', () => {
      const questions = Array.from({ length: 100 }, (_, i) => ({ id: i }));
      const chunks = chunkArray(questions, 10);

      expect(chunks.length).toBe(10);
      chunks.forEach((chunk, i) => {
        if (i < 9) {
          expect(chunk.length).toBe(10);
        }
      });
    });

    it('should chunk 150 items into batches of 10 with remainder', () => {
      const questions = Array.from({ length: 150 }, (_, i) => ({ id: i }));
      const chunks = chunkArray(questions, 10);

      expect(chunks.length).toBe(15);
      // All chunks should be size 10
      chunks.forEach((chunk) => {
        expect(chunk.length).toBe(10);
      });
    });

    it('should chunk 95 items into batches of 10 with smaller last batch', () => {
      const questions = Array.from({ length: 95 }, (_, i) => ({ id: i }));
      const chunks = chunkArray(questions, 10);

      expect(chunks.length).toBe(10);
      // First 9 chunks should be size 10
      chunks.slice(0, 9).forEach((chunk) => {
        expect(chunk.length).toBe(10);
      });
      // Last chunk should be size 5
      expect(chunks[9].length).toBe(5);
    });
  });
});

describe('Embeddings Module - enforcePerUserLimit', () => {
  it('limits number of items per user', () => {
    const items = [
      { userId: 'user1' as Id<'users'>, value: 1 },
      { userId: 'user1' as Id<'users'>, value: 2 },
      { userId: 'user1' as Id<'users'>, value: 3 },
      { userId: 'user2' as Id<'users'>, value: 4 },
    ];

    const limited = enforcePerUserLimit(items, 2);
    expect(limited.length).toBe(3);
    expect(limited.filter((item) => item.userId === ('user1' as Id<'users'>))).toHaveLength(2);
    expect(limited.filter((item) => item.userId === ('user2' as Id<'users'>))).toHaveLength(1);
  });

  it('returns empty array when limit is zero', () => {
    const items = [{ userId: 'user1' as Id<'users'>, value: 1 }];
    const limited = enforcePerUserLimit(items, 0);
    expect(limited).toEqual([]);
  });

  it('preserves item order', () => {
    const items = [
      { userId: 'user1' as Id<'users'>, value: 1 },
      { userId: 'user2' as Id<'users'>, value: 2 },
      { userId: 'user1' as Id<'users'>, value: 3 },
      { userId: 'user2' as Id<'users'>, value: 4 },
    ];

    const limited = enforcePerUserLimit(items, 1);
    expect(limited).toEqual([
      { userId: 'user1' as Id<'users'>, value: 1 },
      { userId: 'user2' as Id<'users'>, value: 2 },
    ]);
  });
});
