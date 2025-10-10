import { describe, expect, it } from 'vitest';

import { getShuffleSeed, shuffleWithSeed } from './shuffle';

describe('shuffleWithSeed', () => {
  describe('determinism', () => {
    it('should produce identical shuffle for same seed', () => {
      const array = ['A', 'B', 'C', 'D'];
      const seed = 'test-seed-123';

      const shuffle1 = shuffleWithSeed(array, seed);
      const shuffle2 = shuffleWithSeed(array, seed);

      expect(shuffle1).toEqual(shuffle2);
    });

    it('should produce different shuffles for different seeds', () => {
      const array = ['A', 'B', 'C', 'D'];
      const seed1 = 'seed-1';
      const seed2 = 'seed-2';

      const shuffle1 = shuffleWithSeed(array, seed1);
      const shuffle2 = shuffleWithSeed(array, seed2);

      // Extremely unlikely to be equal (1/24 chance for 4 elements)
      expect(shuffle1).not.toEqual(shuffle2);
    });

    it('should produce same shuffle for same questionId+userId', () => {
      const array = ['Paris', 'London', 'Berlin', 'Madrid'];
      const questionId = 'question-123';
      const userId = 'user-456';
      const seed = getShuffleSeed(questionId, userId);

      const shuffle1 = shuffleWithSeed(array, seed);
      const shuffle2 = shuffleWithSeed(array, seed);

      expect(shuffle1).toEqual(shuffle2);
    });
  });

  describe('element preservation', () => {
    it('should preserve all elements', () => {
      const array = ['A', 'B', 'C', 'D'];
      const shuffled = shuffleWithSeed(array, 'test-seed');

      // Should contain same elements
      expect(shuffled.sort()).toEqual(array.sort());
      expect(shuffled.length).toBe(array.length);
    });

    it('should not lose or duplicate elements', () => {
      const array = ['Option 1', 'Option 2', 'Option 3', 'Option 4'];
      const shuffled = shuffleWithSeed(array, 'another-seed');

      // Check each element appears exactly once
      array.forEach((element) => {
        const count = shuffled.filter((item) => item === element).length;
        expect(count).toBe(1);
      });
    });

    it('should handle duplicate values correctly', () => {
      const array = ['A', 'A', 'B', 'B'];
      const shuffled = shuffleWithSeed(array, 'dup-seed');

      expect(shuffled.length).toBe(4);
      expect(shuffled.filter((x) => x === 'A').length).toBe(2);
      expect(shuffled.filter((x) => x === 'B').length).toBe(2);
    });
  });

  describe('immutability', () => {
    it('should not mutate original array', () => {
      const original = ['A', 'B', 'C', 'D'];
      const copy = [...original];

      shuffleWithSeed(original, 'test-seed');

      expect(original).toEqual(copy);
    });

    it('should return new array instance', () => {
      const original = ['A', 'B', 'C', 'D'];
      const shuffled = shuffleWithSeed(original, 'test-seed');

      expect(shuffled).not.toBe(original);
    });
  });

  describe('edge cases', () => {
    it('should handle empty array', () => {
      const array: string[] = [];
      const shuffled = shuffleWithSeed(array, 'test-seed');

      expect(shuffled).toEqual([]);
      expect(shuffled.length).toBe(0);
    });

    it('should handle single element array', () => {
      const array = ['Only Option'];
      const shuffled = shuffleWithSeed(array, 'test-seed');

      expect(shuffled).toEqual(['Only Option']);
      expect(shuffled.length).toBe(1);
    });

    it('should handle two element array (true/false)', () => {
      const array = ['True', 'False'];
      const shuffled = shuffleWithSeed(array, 'test-seed');

      expect(shuffled.length).toBe(2);
      expect(shuffled).toContain('True');
      expect(shuffled).toContain('False');
    });

    it('should handle four element array (multiple choice)', () => {
      const array = ['Option A', 'Option B', 'Option C', 'Option D'];
      const shuffled = shuffleWithSeed(array, 'test-seed');

      expect(shuffled.length).toBe(4);
      array.forEach((option) => {
        expect(shuffled).toContain(option);
      });
    });

    it('should handle numeric arrays', () => {
      const array = [1, 2, 3, 4, 5];
      const shuffled = shuffleWithSeed(array, 'number-seed');

      expect(shuffled.sort()).toEqual([1, 2, 3, 4, 5]);
      expect(shuffled.length).toBe(5);
    });

    it('should handle object arrays', () => {
      const array = [{ id: 1 }, { id: 2 }, { id: 3 }];
      const shuffled = shuffleWithSeed(array, 'object-seed');

      expect(shuffled.length).toBe(3);
      expect(shuffled.map((item) => item.id).sort()).toEqual([1, 2, 3]);
    });
  });

  describe('randomness quality', () => {
    it('should actually shuffle (not return original order)', () => {
      const array = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

      // Try multiple seeds - at least one should produce different order
      let foundDifferentOrder = false;
      for (let i = 0; i < 10; i++) {
        const shuffled = shuffleWithSeed(array, `seed-${i}`);
        if (JSON.stringify(shuffled) !== JSON.stringify(array)) {
          foundDifferentOrder = true;
          break;
        }
      }

      expect(foundDifferentOrder).toBe(true);
    });

    it('should produce different shuffles for sequential seeds', () => {
      const array = ['A', 'B', 'C', 'D'];
      const shuffles = new Set<string>();

      // Generate shuffles for sequential seeds
      for (let i = 0; i < 10; i++) {
        const shuffled = shuffleWithSeed(array, `seed-${i}`);
        shuffles.add(JSON.stringify(shuffled));
      }

      // Should have variety (not all the same)
      expect(shuffles.size).toBeGreaterThan(1);
    });
  });

  describe('realistic quiz scenarios', () => {
    it('should shuffle quiz options consistently per question+user', () => {
      const options = ['Paris', 'London', 'Berlin', 'Madrid'];
      const questionId = 'geography-123';
      const userId = 'student-456';
      const seed = getShuffleSeed(questionId, userId);

      // User reviews question multiple times
      const attempt1 = shuffleWithSeed(options, seed);
      const attempt2 = shuffleWithSeed(options, seed);
      const attempt3 = shuffleWithSeed(options, seed);

      // Should see same order every time
      expect(attempt1).toEqual(attempt2);
      expect(attempt2).toEqual(attempt3);
    });

    it('should give different shuffles to different users', () => {
      const options = ['Paris', 'London', 'Berlin', 'Madrid'];
      const questionId = 'geography-123';

      const user1Seed = getShuffleSeed(questionId, 'user-1');
      const user2Seed = getShuffleSeed(questionId, 'user-2');

      const user1Shuffle = shuffleWithSeed(options, user1Seed);
      const user2Shuffle = shuffleWithSeed(options, user2Seed);

      // Different users should see different shuffles
      expect(user1Shuffle).not.toEqual(user2Shuffle);
    });

    it('should handle correct answer in any position', () => {
      const options = ['Correct', 'Wrong1', 'Wrong2', 'Wrong3'];
      const shuffled = shuffleWithSeed(options, 'test-seed');

      // Correct answer should still be present
      expect(shuffled).toContain('Correct');

      // Should be able to validate answer regardless of position
      const userAnswer = 'Correct';
      const isCorrect = shuffled.includes(userAnswer) && userAnswer === 'Correct';
      expect(isCorrect).toBe(true);
    });
  });
});

describe('getShuffleSeed', () => {
  it('should create consistent seed for same inputs', () => {
    const seed1 = getShuffleSeed('question-123', 'user-456');
    const seed2 = getShuffleSeed('question-123', 'user-456');

    expect(seed1).toBe(seed2);
  });

  it('should create different seeds for different users', () => {
    const seed1 = getShuffleSeed('question-123', 'user-1');
    const seed2 = getShuffleSeed('question-123', 'user-2');

    expect(seed1).not.toBe(seed2);
  });

  it('should create different seeds for different questions', () => {
    const seed1 = getShuffleSeed('question-1', 'user-123');
    const seed2 = getShuffleSeed('question-2', 'user-123');

    expect(seed1).not.toBe(seed2);
  });

  it('should handle anonymous users consistently', () => {
    const seed1 = getShuffleSeed('question-123');
    const seed2 = getShuffleSeed('question-123');

    expect(seed1).toBe(seed2);
    expect(seed1).toContain('anonymous');
  });

  it('should create different seeds for anonymous vs authenticated', () => {
    const anonymousSeed = getShuffleSeed('question-123');
    const userSeed = getShuffleSeed('question-123', 'user-456');

    expect(anonymousSeed).not.toBe(userSeed);
  });

  it('should format seed correctly', () => {
    const seed = getShuffleSeed('question-abc', 'user-xyz');

    expect(seed).toBe('question-abc-user-xyz');
    expect(seed).toContain('-');
  });

  it('should handle empty userId as anonymous', () => {
    const seed1 = getShuffleSeed('question-123', '');
    const seed2 = getShuffleSeed('question-123');

    // Empty string should be treated same as undefined
    expect(seed1).toBe(seed2);
  });

  it('should handle special characters in IDs', () => {
    const seed = getShuffleSeed('question-123!@#', 'user-456$%^');

    expect(seed).toBe('question-123!@#-user-456$%^');
    // Should still work with shuffle
    expect(() => shuffleWithSeed(['A', 'B'], seed)).not.toThrow();
  });
});
