import { describe, expect, it } from 'vitest';

import {
  hasExecutionErrors,
  isProdConfig,
  isSuccessfulExecution,
  isValidConfig,
  isValidInputSet,
  isValidPhase,
  type ExecutionResult,
  type InfraConfig,
  type InputSet,
  type PromptPhase,
} from './lab';

describe('Lab Type Guards', () => {
  describe('isProdConfig', () => {
    it('returns true for production config', () => {
      const config: InfraConfig = {
        id: '1',
        name: 'PROD',
        isProd: true,
        provider: 'google',
        model: 'gemini-2.5-flash',
        temperature: 1.0,
        maxTokens: 8192,
        phases: [{ name: 'Test', template: 'Test prompt' }],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      expect(isProdConfig(config)).toBe(true);
    });

    it('returns false for non-production config', () => {
      const config: InfraConfig = {
        id: '2',
        name: 'Draft',
        isProd: false,
        provider: 'openai',
        model: 'gpt-5-mini',
        temperature: 0.7,
        maxTokens: 4096,
        phases: [{ name: 'Test', template: 'Test prompt' }],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      expect(isProdConfig(config)).toBe(false);
    });
  });

  describe('isValidInputSet', () => {
    it('returns true for valid input set', () => {
      const set: InputSet = {
        id: '1',
        name: 'Test Set',
        inputs: ['Input 1', 'Input 2', 'Input 3'],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      expect(isValidInputSet(set)).toBe(true);
    });

    it('returns false for empty inputs', () => {
      const set: InputSet = {
        id: '1',
        name: 'Empty',
        inputs: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      expect(isValidInputSet(set)).toBe(false);
    });

    it('returns false for too many inputs', () => {
      const set: InputSet = {
        id: '1',
        name: 'Too Many',
        inputs: Array(11).fill('Input'),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      expect(isValidInputSet(set)).toBe(false);
    });

    it('returns false for blank inputs', () => {
      const set: InputSet = {
        id: '1',
        name: 'Blank',
        inputs: ['Valid', '   ', 'Also valid'],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      expect(isValidInputSet(set)).toBe(false);
    });
  });

  describe('isValidPhase', () => {
    it('returns true for valid phase', () => {
      const phase: PromptPhase = {
        name: 'Intent Clarification',
        template: 'Analyze: {{userInput}}',
      };
      expect(isValidPhase(phase)).toBe(true);
    });

    it('returns false for empty name', () => {
      const phase: PromptPhase = {
        name: '   ',
        template: 'Test',
      };
      expect(isValidPhase(phase)).toBe(false);
    });

    it('returns false for empty template', () => {
      const phase: PromptPhase = {
        name: 'Test',
        template: '   ',
      };
      expect(isValidPhase(phase)).toBe(false);
    });
  });

  describe('isValidConfig', () => {
    it('returns true for valid config', () => {
      const config: InfraConfig = {
        id: '1',
        name: 'Valid Config',
        isProd: false,
        provider: 'google',
        model: 'gemini-2.5-flash',
        temperature: 1.0,
        maxTokens: 8192,
        phases: [
          { name: 'Phase 1', template: 'Template 1' },
          { name: 'Phase 2', template: 'Template 2', outputTo: 'result1' },
        ],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      expect(isValidConfig(config)).toBe(true);
    });

    it('returns false for invalid temperature', () => {
      const config: InfraConfig = {
        id: '1',
        name: 'Invalid Temp',
        isProd: false,
        provider: 'google',
        model: 'gemini-2.5-flash',
        temperature: 2.5, // Invalid: > 2
        maxTokens: 8192,
        phases: [{ name: 'Test', template: 'Test' }],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      expect(isValidConfig(config)).toBe(false);
    });

    it('returns false for invalid maxTokens', () => {
      const config: InfraConfig = {
        id: '1',
        name: 'Invalid Tokens',
        isProd: false,
        provider: 'google',
        model: 'gemini-2.5-flash',
        temperature: 1.0,
        maxTokens: 0, // Invalid: < 1
        phases: [{ name: 'Test', template: 'Test' }],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      expect(isValidConfig(config)).toBe(false);
    });

    it('returns false for no phases', () => {
      const config: InfraConfig = {
        id: '1',
        name: 'No Phases',
        isProd: false,
        provider: 'google',
        model: 'gemini-2.5-flash',
        temperature: 1.0,
        maxTokens: 8192,
        phases: [], // Invalid: no phases
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      expect(isValidConfig(config)).toBe(false);
    });
  });

  describe('hasExecutionErrors', () => {
    it('returns true for result with errors', () => {
      const result: ExecutionResult = {
        configId: '1',
        configName: 'Test',
        input: 'Test input',
        questions: [],
        rawOutput: {},
        latency: 1000,
        valid: false,
        errors: ['Schema validation failed'],
        executedAt: Date.now(),
      };
      expect(hasExecutionErrors(result)).toBe(true);
    });

    it('returns true for invalid result', () => {
      const result: ExecutionResult = {
        configId: '1',
        configName: 'Test',
        input: 'Test input',
        questions: [],
        rawOutput: {},
        latency: 1000,
        valid: false,
        errors: [],
        executedAt: Date.now(),
      };
      expect(hasExecutionErrors(result)).toBe(true);
    });

    it('returns false for valid result with no errors', () => {
      const result: ExecutionResult = {
        configId: '1',
        configName: 'Test',
        input: 'Test input',
        questions: [{ question: 'Test' }],
        rawOutput: {},
        latency: 1000,
        valid: true,
        errors: [],
        executedAt: Date.now(),
      };
      expect(hasExecutionErrors(result)).toBe(false);
    });
  });

  describe('isSuccessfulExecution', () => {
    it('returns true for successful result', () => {
      const result: ExecutionResult = {
        configId: '1',
        configName: 'Test',
        input: 'Test input',
        questions: [{ question: 'Test 1' }, { question: 'Test 2' }],
        rawOutput: {},
        latency: 1000,
        valid: true,
        errors: [],
        executedAt: Date.now(),
      };
      expect(isSuccessfulExecution(result)).toBe(true);
    });

    it('returns false for result with errors', () => {
      const result: ExecutionResult = {
        configId: '1',
        configName: 'Test',
        input: 'Test input',
        questions: [{ question: 'Test' }],
        rawOutput: {},
        latency: 1000,
        valid: true,
        errors: ['Warning'],
        executedAt: Date.now(),
      };
      expect(isSuccessfulExecution(result)).toBe(false);
    });

    it('returns false for no questions', () => {
      const result: ExecutionResult = {
        configId: '1',
        configName: 'Test',
        input: 'Test input',
        questions: [],
        rawOutput: {},
        latency: 1000,
        valid: true,
        errors: [],
        executedAt: Date.now(),
      };
      expect(isSuccessfulExecution(result)).toBe(false);
    });
  });
});
