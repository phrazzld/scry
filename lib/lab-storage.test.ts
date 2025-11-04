import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ExecutionResult, InfraConfig, TestInput } from '@/types/lab';

import {
  clearAllLabData,
  clearResults,
  getLabDataSize,
  isApproachingQuota,
  loadConfigs,
  loadInputs,
  loadResults,
  saveConfigs,
  saveInputs,
  saveResults,
} from './lab-storage';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

(global as any).localStorage = localStorageMock;

describe('Lab Storage', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  describe('TestInputs', () => {
    const mockInput: TestInput = {
      id: '1',
      text: 'Test input text',
      createdAt: Date.now(),
    };

    it('saves and loads test inputs', () => {
      const inputs = [mockInput];
      const saved = saveInputs(inputs);
      expect(saved).toBe(true);

      const loaded = loadInputs();
      expect(loaded).toHaveLength(1);
      expect(loaded[0].id).toBe('1');
      expect(loaded[0].text).toBe('Test input text');
    });

    it('returns empty array when no test inputs', () => {
      const loaded = loadInputs();
      expect(loaded).toEqual([]);
    });

    it('handles invalid JSON gracefully', () => {
      localStorageMock.setItem('scry-lab-inputs', 'invalid json');
      const loaded = loadInputs();
      expect(loaded).toEqual([]);
    });

    it('handles non-array JSON gracefully', () => {
      localStorageMock.setItem('scry-lab-inputs', '{"key": "value"}');
      const loaded = loadInputs();
      expect(loaded).toEqual([]);
    });
  });

  describe('Configs', () => {
    const mockConfig: InfraConfig = {
      id: '1',
      name: 'Test Config',
      isProd: false,
      provider: 'google',
      model: 'gemini-2.5-flash',
      temperature: 1.0,
      maxTokens: 8192,
      phases: [{ name: 'Test', template: 'Test prompt' }],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    it('saves and loads configs', () => {
      const configs = [mockConfig];
      const saved = saveConfigs(configs);
      expect(saved).toBe(true);

      const loaded = loadConfigs();
      expect(loaded).toHaveLength(1);
      expect(loaded[0].id).toBe('1');
      expect(loaded[0].name).toBe('Test Config');
      expect(loaded[0].provider).toBe('google');
    });

    it('returns empty array when no configs', () => {
      const loaded = loadConfigs();
      expect(loaded).toEqual([]);
    });

    it('handles invalid JSON gracefully', () => {
      localStorageMock.setItem('scry-lab-configs', 'invalid json');
      const loaded = loadConfigs();
      expect(loaded).toEqual([]);
    });
  });

  describe('Results', () => {
    const mockResult: ExecutionResult = {
      configId: '1',
      configName: 'Test',
      input: 'Test input',
      questions: [{ question: 'Test question' }],
      rawOutput: {},
      latency: 1000,
      valid: true,
      errors: [],
      executedAt: Date.now(),
    };

    it('saves and loads results', () => {
      const results = [mockResult];
      const saved = saveResults(results);
      expect(saved).toBe(true);

      const loaded = loadResults();
      expect(loaded).toHaveLength(1);
      expect(loaded[0].configId).toBe('1');
      expect(loaded[0].input).toBe('Test input');
    });

    it('returns empty array when no results', () => {
      const loaded = loadResults();
      expect(loaded).toEqual([]);
    });

    it('clears results', () => {
      saveResults([mockResult]);
      clearResults();
      const loaded = loadResults();
      expect(loaded).toEqual([]);
    });
  });

  describe('clearAllLabData', () => {
    it('clears all lab data from localStorage', () => {
      const mockInput: TestInput = {
        id: '1',
        text: 'Test',
        createdAt: Date.now(),
      };
      const mockConfig: InfraConfig = {
        id: '1',
        name: 'Test',
        isProd: false,
        provider: 'google',
        model: 'test',
        temperature: 1.0,
        maxTokens: 100,
        phases: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      const mockResult: ExecutionResult = {
        configId: '1',
        configName: 'Test',
        input: 'Test',
        questions: [],
        rawOutput: {},
        latency: 0,
        valid: true,
        errors: [],
        executedAt: Date.now(),
      };

      saveInputs([mockInput]);
      saveConfigs([mockConfig]);
      saveResults([mockResult]);

      clearAllLabData();

      expect(loadInputs()).toEqual([]);
      expect(loadConfigs()).toEqual([]);
      expect(loadResults()).toEqual([]);
    });
  });

  describe('getLabDataSize', () => {
    it('calculates approximate size of lab data', () => {
      const mockData: TestInput = {
        id: '1',
        text: 'Test',
        createdAt: Date.now(),
      };

      saveInputs([mockData]);
      const size = getLabDataSize();
      expect(size).toBeGreaterThan(0);
    });

    it('returns 0 when no data', () => {
      const size = getLabDataSize();
      expect(size).toBe(0);
    });
  });

  describe('isApproachingQuota', () => {
    it('returns false when below threshold', () => {
      const mockInput: TestInput = {
        id: '1',
        text: 'Small test input',
        createdAt: Date.now(),
      };
      saveInputs([mockInput]);

      const approaching = isApproachingQuota(1024 * 1024); // 1MB threshold
      expect(approaching).toBe(false);
    });

    it('returns true when above threshold', () => {
      const mockInput: TestInput = {
        id: '1',
        text: 'Large test input',
        createdAt: Date.now(),
      };
      saveInputs([mockInput]);

      const approaching = isApproachingQuota(10); // Tiny threshold
      expect(approaching).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('handles JSON.stringify errors', () => {
      // Create circular reference

      const circular: any = { id: '1', text: 'Test' };
      circular.self = circular;

      const saved = saveInputs([circular as TestInput]);
      expect(saved).toBe(false);
    });

    it('handles storage quota errors', () => {
      const originalSetItem = localStorageMock.setItem;
      localStorageMock.setItem = vi.fn(() => {
        throw new Error('QuotaExceededError');
      });

      const mockInput: TestInput = {
        id: '1',
        text: 'Test',
        createdAt: Date.now(),
      };

      const saved = saveInputs([mockInput]);
      expect(saved).toBe(false);

      localStorageMock.setItem = originalSetItem;
    });
  });
});
