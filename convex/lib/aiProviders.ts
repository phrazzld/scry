import { createGoogleGenerativeAI } from '@ai-sdk/google';
import type { LanguageModel } from 'ai';
import OpenAI from 'openai';
import type { Logger } from 'pino';
import { getSecretDiagnostics } from './envDiagnostics';

type SecretDiagnostics = ReturnType<typeof getSecretDiagnostics>;

export interface ProviderClient {
  model?: LanguageModel;
  openaiClient?: OpenAI;
  provider: 'google' | 'openai';
  diagnostics: SecretDiagnostics;
}

export interface InitializeProviderOptions {
  logger?: Logger;
  logContext?: Record<string, unknown>;
  deployment?: string;
}

const GOOGLE_PROVIDER = 'google' as const;
const OPENAI_PROVIDER = 'openai' as const;

export function initializeProvider(
  requestedProvider: string,
  modelName: string,
  options: InitializeProviderOptions = {}
): ProviderClient {
  const provider = normalizeProvider(requestedProvider);

  if (provider === GOOGLE_PROVIDER) {
    return initializeGoogleProvider(modelName, options);
  }

  if (provider === OPENAI_PROVIDER) {
    return initializeOpenAIProvider(modelName, options);
  }

  const errorMessage = `Unsupported AI_PROVIDER: ${requestedProvider}. Use 'google' or 'openai'.`;
  logError(
    options.logger,
    { ...(options.logContext ?? {}), provider: requestedProvider },
    errorMessage
  );
  throw new Error(errorMessage);
}

function initializeGoogleProvider(
  modelName: string,
  options: InitializeProviderOptions
): ProviderClient {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  const diagnostics = getSecretDiagnostics(apiKey);
  const logFields = buildLogFields(options, GOOGLE_PROVIDER, modelName, diagnostics);

  logInfo(options.logger, logFields, 'Using Google AI provider');

  if (!apiKey?.trim()) {
    const errorMessage = 'GOOGLE_AI_API_KEY not configured in Convex environment';
    logError(options.logger, logFields, errorMessage);
    throw new Error(errorMessage);
  }

  const google = createGoogleGenerativeAI({ apiKey });
  // Cast to LanguageModel to match consumers that expect the AI SDK interface
  const model = google(modelName) as unknown as LanguageModel;

  return {
    provider: GOOGLE_PROVIDER,
    model,
    diagnostics,
  };
}

function initializeOpenAIProvider(
  modelName: string,
  options: InitializeProviderOptions
): ProviderClient {
  const apiKey = process.env.OPENAI_API_KEY;
  const diagnostics = getSecretDiagnostics(apiKey);
  const logFields = buildLogFields(options, OPENAI_PROVIDER, modelName, diagnostics);

  logInfo(options.logger, logFields, 'Using OpenAI provider with Responses API');

  if (!apiKey?.trim()) {
    const errorMessage = 'OPENAI_API_KEY not configured in Convex environment';
    logError(options.logger, logFields, errorMessage);
    throw new Error(errorMessage);
  }

  const openaiClient = new OpenAI({ apiKey });

  return {
    provider: OPENAI_PROVIDER,
    openaiClient,
    diagnostics,
  };
}

function buildLogFields(
  options: InitializeProviderOptions,
  provider: 'google' | 'openai',
  modelName: string,
  diagnostics: SecretDiagnostics
): Record<string, unknown> {
  return {
    ...(options.logContext ?? {}),
    provider,
    model: modelName,
    keyDiagnostics: diagnostics,
    deployment: options.deployment ?? process.env.CONVEX_CLOUD_URL ?? 'unknown',
  };
}

function logInfo(
  logger: Logger | undefined,
  context: Record<string, unknown>,
  message: string
): void {
  if (logger) {
    logger.info(context, message);
  }
}

function logError(
  logger: Logger | undefined,
  context: Record<string, unknown>,
  message: string
): void {
  if (logger) {
    logger.error(context, message);
  }
}

function normalizeProvider(provider: string): 'google' | 'openai' | null {
  if (!provider) {
    return OPENAI_PROVIDER;
  }

  const normalized = provider.toLowerCase();
  if (normalized === GOOGLE_PROVIDER || normalized === OPENAI_PROVIDER) {
    return normalized;
  }

  return null;
}
