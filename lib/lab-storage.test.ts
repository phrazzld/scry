import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ExecutionResult, InfraConfig, InputSet } from '@/types/lab';

import {
  clearAllLabData,
  clearResults,
  getLabDataSize,
  isApproachingQuota,
  loadConfigs,
  loadInputSets,
  loadResults,
  saveConfigs,
  saveInputSets,
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

  describe('InputSets', () => {
    const mockInputSet: InputSet = {
      id: '1',
      name: 'Test Set',
      inputs: ['Input 1', 'Input 2'],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    it('saves and loads input sets', () => {
      const sets = [mockInputSet];
      const saved = saveInputSets(sets);
      expect(saved).toBe(true);

      const loaded = loadInputSets();
      expect(loaded).toHaveLength(1);
      expect(loaded[0].id).toBe('1');
      expect(loaded[0].name).toBe('Test Set');
      expect(loaded[0].inputs).toEqual(['Input 1', 'Input 2']);
    });

    it('returns empty array when no input sets', () => {
      const loaded = loadInputSets();
      expect(loaded).toEqual([]);
    });

    it('handles invalid JSON gracefully', () => {
      localStorageMock.setItem('scry-lab-input-sets', 'invalid json');
      const loaded = loadInputSets();
      expect(loaded).toEqual([]);
    });

    it('handles non-array JSON gracefully', () => {
      localStorageMock.setItem('scry-lab-input-sets', '{"key": "value"}');
      const loaded = loadInputSets();
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
      const mockInputSet: InputSet = {
        id: '1',
        name: 'Test',
        inputs: ['Test'],
        createdAt: Date.now(),
        updatedAt: Date.now(),
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

      saveInputSets([mockInputSet]);
      saveConfigs([mockConfig]);
      saveResults([mockResult]);

      clearAllLabData();

      expect(loadInputSets()).toEqual([]);
      expect(loadConfigs()).toEqual([]);
      expect(loadResults()).toEqual([]);
    });
  });

  describe('getLabDataSize', () => {
    it('calculates approximate size of lab data', () => {
      const mockData = {
        id: '1',
        name: 'Test',
        inputs: ['Test'],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      saveInputSets([mockData as InputSet]);
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
      const mockInputSet: InputSet = {
        id: '1',
        name: 'Small',
        inputs: ['Test'],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      saveInputSets([mockInputSet]);

      const approaching = isApproachingQuota(1024 * 1024); // 1MB threshold
      expect(approaching).toBe(false);
    });

    it('returns true when above threshold', () => {
      const mockInputSet: InputSet = {
        id: '1',
        name: 'Large',
        inputs: ['Test'],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      saveInputSets([mockInputSet]);

      const approaching = isApproachingQuota(10); // Tiny threshold
      expect(approaching).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('handles JSON.stringify errors', () => {
      // Create circular reference
       
      const circular: any = { id: '1', name: 'Test' };
      circular.self = circular;

      const saved = saveInputSets([circular as InputSet]);
      expect(saved).toBe(false);
    });

    it('handles storage quota errors', () => {
      const originalSetItem = localStorageMock.setItem;
      localStorageMock.setItem = vi.fn(() => {
        throw new Error('QuotaExceededError');
      });

      const mockInputSet: InputSet = {
        id: '1',
        name: 'Test',
        inputs: ['Test'],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const saved = saveInputSets([mockInputSet]);
      expect(saved).toBe(false);

      localStorageMock.setItem = originalSetItem;
    });
  });
});
