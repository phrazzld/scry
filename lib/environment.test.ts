import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  getDeploymentEnvironment,
  getEnvironmentDisplayName,
  isValidSessionEnvironment,
} from './environment';

describe('environment utilities', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Save original env
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    // Restore original env
    process.env = originalEnv;
  });

  describe('getDeploymentEnvironment', () => {
    it('should return production when VERCEL_ENV is production', () => {
      process.env.VERCEL_ENV = 'production';
      expect(getDeploymentEnvironment()).toBe('production');
    });

    it('should return preview with branch name when VERCEL_ENV is preview', () => {
      process.env.VERCEL_ENV = 'preview';
      process.env.VERCEL_GIT_COMMIT_REF = 'feature-branch';

      expect(getDeploymentEnvironment()).toBe('preview-feature-branch');
    });

    it('should return preview without branch when no commit ref', () => {
      process.env.VERCEL_ENV = 'preview';
      delete process.env.VERCEL_GIT_COMMIT_REF;

      expect(getDeploymentEnvironment()).toBe('preview');
    });

    it('should return development when VERCEL_ENV is not set', () => {
      delete process.env.VERCEL_ENV;

      expect(getDeploymentEnvironment()).toBe('development');
    });

    it('should return development for unknown VERCEL_ENV values', () => {
      process.env.VERCEL_ENV = 'staging';

      expect(getDeploymentEnvironment()).toBe('development');
    });
  });

  describe('isValidSessionEnvironment', () => {
    it('should allow production sessions only in production', () => {
      expect(isValidSessionEnvironment('production', 'production')).toBe(true);
      expect(isValidSessionEnvironment('production', 'preview')).toBe(false);
      expect(isValidSessionEnvironment('production', 'development')).toBe(false);
    });

    it('should allow preview sessions in any preview environment', () => {
      expect(isValidSessionEnvironment('preview-main', 'preview-feature')).toBe(true);
      expect(isValidSessionEnvironment('preview', 'preview-branch')).toBe(true);
      expect(isValidSessionEnvironment('preview-branch', 'production')).toBe(false);
    });

    it('should allow development sessions only in development', () => {
      expect(isValidSessionEnvironment('development', 'development')).toBe(true);
      expect(isValidSessionEnvironment('development', 'production')).toBe(false);
      expect(isValidSessionEnvironment('development', 'preview')).toBe(false);
    });

    it('should handle legacy sessions without environment', () => {
      expect(isValidSessionEnvironment(undefined, 'development')).toBe(true);
      expect(isValidSessionEnvironment(undefined, 'production')).toBe(false);
      expect(isValidSessionEnvironment(undefined, 'preview')).toBe(false);
    });

    it('should deny unknown environments', () => {
      expect(isValidSessionEnvironment('unknown', 'production')).toBe(false);
      expect(isValidSessionEnvironment('staging', 'staging')).toBe(false);
    });
  });

  describe('getEnvironmentDisplayName', () => {
    it('should format production environment', () => {
      expect(getEnvironmentDisplayName('production')).toBe('Production');
    });

    it('should format preview environment with branch', () => {
      expect(getEnvironmentDisplayName('preview-main')).toBe('Preview (main)');
      expect(getEnvironmentDisplayName('preview-feature-xyz')).toBe('Preview (feature-xyz)');
    });

    it('should format preview environment without branch', () => {
      expect(getEnvironmentDisplayName('preview')).toBe('Preview');
    });

    it('should format development environment', () => {
      expect(getEnvironmentDisplayName('development')).toBe('Development');
    });

    it('should format unknown environments', () => {
      expect(getEnvironmentDisplayName('staging')).toBe('Unknown');
      expect(getEnvironmentDisplayName('custom-env')).toBe('Unknown');
    });
  });
});
