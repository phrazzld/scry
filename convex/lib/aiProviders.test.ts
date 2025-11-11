import { createGoogleGenerativeAI } from '@ai-sdk/google';
import OpenAI from 'openai';
import type { Logger } from 'pino';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initializeProvider } from './aiProviders';
import { getSecretDiagnostics } from './envDiagnostics';

vi.mock('@ai-sdk/google', () => ({
  createGoogleGenerativeAI: vi.fn(),
}));

vi.mock('openai', () => ({
  default: vi.fn(),
}));

const mockCreateGoogleGenerativeAI = vi.mocked(createGoogleGenerativeAI);
const mockOpenAIConstructor = vi.mocked(OpenAI);

const createLogger = (): Logger =>
  ({
    info: vi.fn(),
    error: vi.fn(),
  }) as unknown as Logger;

const originalEnv = { ...process.env };

describe('initializeProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    delete process.env.GOOGLE_AI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    process.env.CONVEX_CLOUD_URL = 'https://test.convex';
  });

  it('initializes Google provider with diagnostics and logging context', async () => {
    process.env.GOOGLE_AI_API_KEY = 'google-key';
    const mockModel = { id: 'gemini-pro' } as any;
    mockCreateGoogleGenerativeAI.mockReturnValue((() => mockModel) as any);
    const logger = createLogger();

    const result = await initializeProvider('google', 'gemini-pro', {
      logger,
      logContext: { configId: 'cfg-123' },
      deployment: 'https://custom.convex',
    });

    expect(mockCreateGoogleGenerativeAI).toHaveBeenCalledWith({ apiKey: 'google-key' });
    expect(result.provider).toBe('google');
    expect(result.model).toBe(mockModel);
    expect(result.openaiClient).toBeUndefined();
    expect(result.diagnostics).toEqual(getSecretDiagnostics('google-key'));

    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        configId: 'cfg-123',
        provider: 'google',
        model: 'gemini-pro',
        keyDiagnostics: getSecretDiagnostics('google-key'),
        deployment: 'https://custom.convex',
      }),
      'Using Google AI provider'
    );
  });

  it('initializes OpenAI provider and returns client with diagnostics', async () => {
    process.env.OPENAI_API_KEY = 'openai-key';
    const mockOpenAIClient = { responses: {} } as any;
    mockOpenAIConstructor.mockReturnValue(mockOpenAIClient);
    const logger = createLogger();

    const result = await initializeProvider('openai', 'gpt-5-mini', {
      logger,
      logContext: { jobId: 'job-42' },
    });

    expect(mockOpenAIConstructor).toHaveBeenCalledWith({ apiKey: 'openai-key' });
    expect(result.provider).toBe('openai');
    expect(result.model).toBeUndefined();
    expect(result.openaiClient).toBe(mockOpenAIClient);
    expect(result.diagnostics).toEqual(getSecretDiagnostics('openai-key'));

    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: 'job-42',
        provider: 'openai',
        model: 'gpt-5-mini',
        keyDiagnostics: getSecretDiagnostics('openai-key'),
        deployment: 'https://test.convex',
      }),
      'Using OpenAI provider with Responses API'
    );
  });

  it('throws when GOOGLE_AI_API_KEY is missing and logs error diagnostics', () => {
    const logger = createLogger();

    expect(() =>
      initializeProvider('google', 'gemini-pro', {
        logger,
      })
    ).toThrow('GOOGLE_AI_API_KEY not configured in Convex environment');

    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'google' }),
      'GOOGLE_AI_API_KEY not configured in Convex environment'
    );
    expect(mockCreateGoogleGenerativeAI).not.toHaveBeenCalled();
  });

  it('throws when OPENAI_API_KEY is missing and logs error diagnostics', () => {
    const logger = createLogger();

    expect(() =>
      initializeProvider('openai', 'gpt-5-mini', {
        logger,
      })
    ).toThrow('OPENAI_API_KEY not configured in Convex environment');

    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'openai' }),
      'OPENAI_API_KEY not configured in Convex environment'
    );
    expect(mockOpenAIConstructor).not.toHaveBeenCalled();
  });

  it('rejects unsupported providers with helpful error message', () => {
    const logger = createLogger();

    expect(() =>
      initializeProvider('anthropic', 'claude-3', {
        logger,
        logContext: { jobId: 'job-99' },
      })
    ).toThrow("Unsupported AI_PROVIDER: anthropic. Use 'google' or 'openai'.");

    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ jobId: 'job-99', provider: 'anthropic' }),
      "Unsupported AI_PROVIDER: anthropic. Use 'google' or 'openai'."
    );
  });
});
