import { describe, expect, it } from 'vitest';

import { getInjectionRateLimitKey, sanitizedTopicSchema } from './prompt-sanitization';

describe('Prompt Validation', () => {
  describe('sanitizedTopicSchema', () => {
    it('should accept valid topics without modification', () => {
      expect(sanitizedTopicSchema.parse('JavaScript')).toBe('JavaScript');
      expect(sanitizedTopicSchema.parse('the NATO alphabet')).toBe('the NATO alphabet');
      expect(sanitizedTopicSchema.parse('HTTP status codes')).toBe('HTTP status codes');
      expect(sanitizedTopicSchema.parse('What is React?')).toBe('What is React?');
      expect(sanitizedTopicSchema.parse('i want to memorize pi to 20 digits')).toBe(
        'i want to memorize pi to 20 digits'
      );
    });

    it('should trim whitespace', () => {
      expect(sanitizedTopicSchema.parse('  JavaScript  ')).toBe('JavaScript');
      expect(sanitizedTopicSchema.parse('   Too    many    spaces   ')).toBe(
        'Too    many    spaces'
      );
    });

    it('should remove control characters that break JSON', () => {
      const withControlChars = 'Topic\x00with\x01control\x02chars';
      expect(sanitizedTopicSchema.parse(withControlChars)).toBe('Topicwithcontrolchars');
    });

    it('should reject topics that are too short', () => {
      expect(() => sanitizedTopicSchema.parse('AB')).toThrow('at least 3 characters');
    });

    it('should reject topics that are too long', () => {
      const longTopic = 'A'.repeat(5001);
      expect(() => sanitizedTopicSchema.parse(longTopic)).toThrow('less than 5000');
    });

    it('should accept topics at length boundaries', () => {
      expect(sanitizedTopicSchema.parse('ABC')).toBe('ABC'); // Min: 3
      expect(sanitizedTopicSchema.parse('A'.repeat(5000))).toBe('A'.repeat(5000)); // Max: 5000
    });

    it('should preserve URLs, emails, quotes, and other legitimate content', () => {
      expect(sanitizedTopicSchema.parse('https://example.com')).toBe('https://example.com');
      expect(sanitizedTopicSchema.parse('test@example.com')).toBe('test@example.com');
      expect(sanitizedTopicSchema.parse('Topic with "quotes"')).toBe('Topic with "quotes"');
      expect(sanitizedTopicSchema.parse('<script>tags</script>')).toBe('<script>tags</script>');
    });
  });

  describe('getInjectionRateLimitKey', () => {
    it('should create rate limit key from IP address', () => {
      expect(getInjectionRateLimitKey('192.168.1.1')).toBe('prompt-injection:192.168.1.1');
      expect(getInjectionRateLimitKey('10.0.0.1')).toBe('prompt-injection:10.0.0.1');
    });
  });
});
