import * as Sentry from '@sentry/nextjs';
import { track as trackClient } from '@vercel/analytics';

import { getDeploymentEnvironment } from './environment';
import { shouldEnableSentry } from './sentry';

const EMAIL_REDACTION_PATTERN =
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(?<!\[EMAIL_REDACTED\])/g;
const EMAIL_REDACTED = '[EMAIL_REDACTED]';
const USER_METADATA_PREFIX = 'user.';

type ServerTrack = typeof import('@vercel/analytics/server').track;

export type AnalyticsEventProperty = string | number | boolean;

export interface AnalyticsEventDefinitions {
  'Quiz Generation Started': {
    jobId: string;
    userId?: string;
    questionCount?: number;
    provider?: string;
  };
  'Quiz Generation Completed': {
    jobId: string;
    userId?: string;
    questionCount: number;
    provider: string;
    durationMs: number;
  };
  'Quiz Generation Failed': {
    jobId: string;
    userId?: string;
    provider?: string;
    errorType?: string;
  };
  'Review Session Started': {
    sessionId: string;
    userId?: string;
    deckId?: string;
  };
  'Review Session Completed': {
    sessionId: string;
    userId?: string;
    deckId?: string;
    durationMs?: number;
    questionCount?: number;
  };
  'Review Session Abandoned': {
    sessionId: string;
    userId?: string;
    deckId?: string;
    questionIndex?: number;
  };
  'Question Created': {
    questionId: string;
    userId?: string;
    source?: string;
  };
  'Question Updated': {
    questionId: string;
    userId?: string;
    source?: string;
  };
  'Question Deleted': {
    questionId: string;
    userId?: string;
    source?: string;
  };
  'Question Archived': {
    questionId: string;
    userId?: string;
    source?: string;
  };
  'Question Restored': {
    questionId: string;
    userId?: string;
    source?: string;
  };
}

export type AnalyticsEventName = keyof AnalyticsEventDefinitions;

export type AnalyticsEventProperties<Name extends AnalyticsEventName> =
  Partial<AnalyticsEventDefinitions[Name]> & Record<string, AnalyticsEventProperty>;

type AnalyticsUserMetadata = Record<string, string>;

interface AnalyticsUserContext {
  userId: string;
  metadata: AnalyticsUserMetadata;
}

let serverTrackPromise: Promise<ServerTrack | null> | null = null;
let currentUserContext: AnalyticsUserContext | null = null;

function isDevelopmentLikeEnvironment(): boolean {
  const nodeEnv = process.env.NODE_ENV;
  if (nodeEnv === 'development' || nodeEnv === 'test') {
    return true;
  }

  const deploymentEnv = getDeploymentEnvironment();
  return deploymentEnv !== 'production';
}

function isAnalyticsEnabled(): boolean {
  if (process.env.NEXT_PUBLIC_DISABLE_ANALYTICS === 'true' || process.env.DISABLE_ANALYTICS === 'true') {
    return false;
  }

  if (process.env.NEXT_PUBLIC_ENABLE_ANALYTICS === 'true' || process.env.ENABLE_ANALYTICS === 'true') {
    return true;
  }

  return !isDevelopmentLikeEnvironment();
}

function isSentryEnabled(): boolean {
  const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;
  return shouldEnableSentry(dsn);
}

function sanitizeString(value: string): string {
  return value.replace(EMAIL_REDACTION_PATTERN, EMAIL_REDACTED);
}

function sanitizeUserMetadata(metadata: AnalyticsUserMetadata | undefined): AnalyticsUserMetadata {
  if (!metadata) {
    return {};
  }

  const sanitized: AnalyticsUserMetadata = {};
  for (const [key, rawValue] of Object.entries(metadata)) {
    if (rawValue === undefined) {
      continue;
    }

    sanitized[key] = sanitizeString(String(rawValue));
  }

  return sanitized;
}

function sanitizeEventProperties(
  properties: Record<string, unknown> | undefined
): Record<string, AnalyticsEventProperty> {
  const sanitized: Record<string, AnalyticsEventProperty> = {};

  if (!properties) {
    return sanitized;
  }

  for (const [key, value] of Object.entries(properties)) {
    if (value === undefined || value === null) {
      continue;
    }

    if (typeof value === 'string') {
      sanitized[key] = sanitizeString(value);
      continue;
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      sanitized[key] = value;
      continue;
    }

    sanitized[key] = sanitizeString(String(value));
  }

  return sanitized;
}

function withUserContext(properties: Record<string, AnalyticsEventProperty>) {
  if (!currentUserContext) {
    return properties;
  }

  const merged: Record<string, AnalyticsEventProperty> = {
    ...properties,
  };

  if (currentUserContext.userId && merged.userId === undefined) {
    merged.userId = currentUserContext.userId;
  }

  for (const [key, value] of Object.entries(currentUserContext.metadata)) {
    const propertyKey = `${USER_METADATA_PREFIX}${key}`;
    if (merged[propertyKey] === undefined) {
      merged[propertyKey] = value;
    }
  }

  return merged;
}

function loadServerTrack(): Promise<ServerTrack | null> {
  if (typeof window !== 'undefined') {
    return Promise.resolve(null);
  }

  if (!serverTrackPromise) {
    serverTrackPromise = import('@vercel/analytics/server')
      .then((module) => module.track)
      .catch((error) => {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('[analytics] Failed to load server analytics module', error);
        }
        return null;
      });
  }

  return serverTrackPromise;
}

function sanitizeContextValue(value: unknown, seen: WeakSet<object>): unknown {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value === 'string') {
    return sanitizeString(value);
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: sanitizeString(value.message),
      stack: process.env.NODE_ENV === 'development' ? value.stack : undefined,
    };
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeContextValue(item, seen));
  }

  if (typeof value === 'object') {
    if (seen.has(value as object)) {
      return '[Circular]';
    }

    seen.add(value as object);
    const record: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      const sanitized = sanitizeContextValue(entry, seen);
      if (sanitized !== undefined) {
        record[key] = sanitized;
      }
    }
    return record;
  }

  return sanitizeString(String(value));
}

function sanitizeErrorContext(context: Record<string, unknown> | undefined) {
  if (!context) {
    return undefined;
  }

  const seen = new WeakSet<object>();
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(context)) {
    const sanitizedValue = sanitizeContextValue(value, seen);
    if (sanitizedValue !== undefined) {
      sanitized[key] = sanitizedValue;
    }
  }

  return sanitized;
}

export function trackEvent<Name extends AnalyticsEventName>(
  name: Name,
  properties?: AnalyticsEventProperties<Name>
): void {
  if (!isAnalyticsEnabled()) {
    return;
  }

  const sanitized = withUserContext(sanitizeEventProperties(properties));

  if (typeof window !== 'undefined') {
    try {
      trackClient(name, sanitized);
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[analytics] Failed to track client event', error);
      }
    }
    return;
  }

  void loadServerTrack()
    .then((track) => {
      if (!track) {
        return;
      }

      return track(name, sanitized).catch((error) => {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('[analytics] Failed to track server event', error);
        }
      });
    })
    .catch((error) => {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[analytics] Failed to load analytics server track function', error);
      }
    });
}

export function reportError(error: Error, context?: Record<string, unknown>): void {
  if (!isSentryEnabled()) {
    return;
  }

  const sanitizedContext = sanitizeErrorContext(context);

  try {
    Sentry.captureException(error, sanitizedContext ? { extra: sanitizedContext } : undefined);
  } catch (captureError) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[analytics] Failed to report error to Sentry', captureError);
    }
  }
}

export function setUserContext(userId: string, metadata: AnalyticsUserMetadata = {}): void {
  const normalizedUserId = userId || 'anonymous';
  const sanitizedMetadata = sanitizeUserMetadata(metadata);

  currentUserContext = {
    userId: normalizedUserId,
    metadata: sanitizedMetadata,
  };

  const sentryUser: Record<string, string> = {
    id: normalizedUserId,
  };

  for (const [key, value] of Object.entries(sanitizedMetadata)) {
    sentryUser[`meta_${key}`] = value;
  }

  try {
    Sentry.setUser(sentryUser);
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[analytics] Failed to set Sentry user context', error);
    }
  }
}

export function clearUserContext(): void {
  currentUserContext = null;

  try {
    Sentry.setUser(null);
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[analytics] Failed to clear Sentry user context', error);
    }
  }
}
