/**
 * Health Check Module
 *
 * Provides health check endpoints for validating Convex deployment status
 * and environment configuration.
 */

import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText } from 'ai';

import { query } from './_generated/server';

/**
 * Required environment variables for Convex functions to work properly
 *
 * These are read via process.env in Convex actions/mutations:
 * - GOOGLE_AI_API_KEY: Used in aiGeneration.ts for quiz generation
 * - RESEND_API_KEY: Used for sending magic link emails
 * - EMAIL_FROM: From address for emails
 * - NEXT_PUBLIC_APP_URL: Application URL for magic links
 * - CONVEX_CLOUD_URL: Deployment URL (automatically set by Convex)
 */
const REQUIRED_ENV_VARS = [
  'GOOGLE_AI_API_KEY',
  'RESEND_API_KEY',
  'EMAIL_FROM',
  'NEXT_PUBLIC_APP_URL',
  'CONVEX_CLOUD_URL',
] as const;

/**
 * Health check query that validates environment configuration
 *
 * Returns:
 * - healthy: true if all required env vars are present
 * - missing: array of missing environment variable names
 * - timestamp: ISO timestamp of the check
 *
 * This query can be called from:
 * - Deployment scripts (pre-deployment validation)
 * - CI/CD pipelines (automated health checks)
 * - Monitoring systems (ongoing health monitoring)
 * - Manual testing (vercel inspect, curl, etc.)
 *
 * Example usage:
 * ```bash
 * # Via Convex CLI
 * npx convex run health:check
 *
 * # Via HTTP (after deployment)
 * curl https://uncommon-axolotl-639.convex.site/api/health:check
 * ```
 */
export const check = query({
  args: {},
  handler: async () => {
    const missing: string[] = [];

    // Check each required environment variable
    for (const varName of REQUIRED_ENV_VARS) {
      const value = process.env[varName];
      if (!value || value.trim() === '') {
        missing.push(varName);
      }
    }

    const healthy = missing.length === 0;

    return {
      healthy,
      missing,
      timestamp: new Date().toISOString(),
      deployment: process.env.CONVEX_CLOUD_URL || 'unknown',
    };
  },
});

/**
 * Detailed health check that provides additional diagnostic information
 *
 * Returns:
 * - status: "healthy" | "degraded" | "unhealthy"
 * - checks: object with individual check results
 * - environment: deployment information
 *
 * "degraded" means some non-critical features may not work
 * "unhealthy" means critical features will fail
 */
export const detailed = query({
  args: {},
  handler: async () => {
    const checks: Record<
      string,
      {
        status: 'ok' | 'missing' | 'empty';
        critical: boolean;
      }
    > = {};

    // Check critical variables
    const criticalVars = ['GOOGLE_AI_API_KEY', 'RESEND_API_KEY'] as const;
    for (const varName of criticalVars) {
      const value = process.env[varName];
      checks[varName] = {
        status: !value ? 'missing' : value.trim() === '' ? 'empty' : 'ok',
        critical: true,
      };
    }

    // Check non-critical but recommended variables
    const recommendedVars = ['EMAIL_FROM', 'NEXT_PUBLIC_APP_URL'] as const;
    for (const varName of recommendedVars) {
      const value = process.env[varName];
      checks[varName] = {
        status: !value ? 'missing' : value.trim() === '' ? 'empty' : 'ok',
        critical: false,
      };
    }

    // Determine overall status
    const hasCriticalFailures = Object.entries(checks).some(
      ([, check]) => check.critical && check.status !== 'ok'
    );
    const hasAnyFailures = Object.entries(checks).some(([, check]) => check.status !== 'ok');

    const status = hasCriticalFailures ? 'unhealthy' : hasAnyFailures ? 'degraded' : 'healthy';

    return {
      status,
      checks,
      timestamp: new Date().toISOString(),
      environment: {
        deployment: process.env.CONVEX_CLOUD_URL || 'unknown',
        nodeVersion: process.version,
      },
    };
  },
});

/**
 * Functional test for Google AI API key
 *
 * Actually tests if the API key works by making a minimal test request.
 * This is more thorough than just checking if the env var exists.
 *
 * Returns:
 * - configured: boolean (is the key set?)
 * - valid: boolean (does the key actually work?)
 * - error: string | null (error message if any)
 * - errorCode: string | null (classified error type)
 *
 * Error codes:
 * - NOT_CONFIGURED: Key is not set in environment
 * - INVALID_KEY: Key is set but invalid/expired
 * - RATE_LIMIT: API rate limit exceeded
 * - API_DISABLED: Google AI API is disabled for this key
 * - NETWORK: Network connectivity issues
 * - UNKNOWN: Unclassified error
 */
export const testGoogleAiKey = query({
  args: {},
  handler: async () => {
    const apiKey = process.env.GOOGLE_AI_API_KEY;

    // Check if key is configured
    if (!apiKey || apiKey === '') {
      return {
        configured: false,
        valid: false,
        error: 'GOOGLE_AI_API_KEY is not set in Convex environment',
        errorCode: 'NOT_CONFIGURED',
      };
    }

    // Test if the key actually works with a minimal request
    try {
      const google = createGoogleGenerativeAI({ apiKey });

      // Make a minimal test request to verify auth works
      // This is much cheaper than generating full content
      await generateText({
        model: google('gemini-2.0-flash-exp'),
        prompt: 'hi', // Minimal prompt
        maxTokens: 1, // Minimize cost
      });

      // If we got here without errors, the key works
      return {
        configured: true,
        valid: true,
        error: null,
        errorCode: null,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Classify the error for actionable recommendations
      let errorCode = 'UNKNOWN';
      if (
        errorMessage.toLowerCase().includes('401') ||
        errorMessage.toLowerCase().includes('unauthorized') ||
        errorMessage.toLowerCase().includes('invalid api key') ||
        errorMessage.toLowerCase().includes('api_key_invalid')
      ) {
        errorCode = 'INVALID_KEY';
      } else if (
        errorMessage.toLowerCase().includes('429') ||
        errorMessage.toLowerCase().includes('quota') ||
        errorMessage.toLowerCase().includes('rate limit')
      ) {
        errorCode = 'RATE_LIMIT';
      } else if (
        errorMessage.toLowerCase().includes('403') ||
        errorMessage.toLowerCase().includes('disabled')
      ) {
        errorCode = 'API_DISABLED';
      } else if (
        errorMessage.toLowerCase().includes('timeout') ||
        errorMessage.toLowerCase().includes('etimedout') ||
        errorMessage.toLowerCase().includes('econnrefused') ||
        errorMessage.toLowerCase().includes('network')
      ) {
        errorCode = 'NETWORK';
      }

      return {
        configured: true,
        valid: false,
        error: errorMessage,
        errorCode,
      };
    }
  },
});

/**
 * Comprehensive health check with functional API testing
 *
 * This is the most thorough health check - it not only checks if environment
 * variables are set, but also tests if they actually work.
 *
 * Should be called periodically by monitoring systems and before critical operations.
 *
 * Note: This is a public query (not internal) so it can be called from the health check endpoint.
 */
export const functional = query({
  args: {},
  handler: async () => {
    // Run detailed environment check inline
    const checks: Record<
      string,
      {
        status: 'ok' | 'missing' | 'empty';
        critical: boolean;
      }
    > = {};

    // Check critical variables
    const criticalVars = ['GOOGLE_AI_API_KEY', 'RESEND_API_KEY'] as const;
    for (const varName of criticalVars) {
      const value = process.env[varName];
      checks[varName] = {
        status: !value ? 'missing' : value.trim() === '' ? 'empty' : 'ok',
        critical: true,
      };
    }

    // Check non-critical but recommended variables
    const recommendedVars = ['EMAIL_FROM', 'NEXT_PUBLIC_APP_URL'] as const;
    for (const varName of recommendedVars) {
      const value = process.env[varName];
      checks[varName] = {
        status: !value ? 'missing' : value.trim() === '' ? 'empty' : 'ok',
        critical: false,
      };
    }

    // Run functional API key test inline
    const apiKey = process.env.GOOGLE_AI_API_KEY;
    let aiKeyTest: {
      configured: boolean;
      valid: boolean;
      error: string | null;
      errorCode: string | null;
    };

    if (!apiKey || apiKey === '') {
      aiKeyTest = {
        configured: false,
        valid: false,
        error: 'GOOGLE_AI_API_KEY is not set in Convex environment',
        errorCode: 'NOT_CONFIGURED',
      };
    } else {
      try {
        const google = createGoogleGenerativeAI({ apiKey });
        await generateText({
          model: google('gemini-2.0-flash-exp'),
          prompt: 'hi',
          maxTokens: 1,
        });
        aiKeyTest = {
          configured: true,
          valid: true,
          error: null,
          errorCode: null,
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        let errorCode = 'UNKNOWN';
        if (
          errorMessage.toLowerCase().includes('401') ||
          errorMessage.toLowerCase().includes('unauthorized') ||
          errorMessage.toLowerCase().includes('invalid api key')
        ) {
          errorCode = 'INVALID_KEY';
        } else if (
          errorMessage.toLowerCase().includes('429') ||
          errorMessage.toLowerCase().includes('quota') ||
          errorMessage.toLowerCase().includes('rate limit')
        ) {
          errorCode = 'RATE_LIMIT';
        } else if (
          errorMessage.toLowerCase().includes('403') ||
          errorMessage.toLowerCase().includes('disabled')
        ) {
          errorCode = 'API_DISABLED';
        } else if (
          errorMessage.toLowerCase().includes('timeout') ||
          errorMessage.toLowerCase().includes('network')
        ) {
          errorCode = 'NETWORK';
        }
        aiKeyTest = {
          configured: true,
          valid: false,
          error: errorMessage,
          errorCode,
        };
      }
    }

    // Determine overall status
    const hasCriticalFailures = Object.entries(checks).some(
      ([, check]) => check.critical && check.status !== 'ok'
    );
    const hasApiKeyFailure = !aiKeyTest.valid;
    const hasAnyFailures = Object.entries(checks).some(([, check]) => check.status !== 'ok');

    const status =
      hasCriticalFailures || hasApiKeyFailure
        ? 'unhealthy'
        : hasAnyFailures
          ? 'degraded'
          : 'healthy';

    return {
      status,
      timestamp: new Date().toISOString(),
      checks: {
        ...checks,
        googleAiKeyFunctional: {
          status: aiKeyTest.valid ? 'ok' : 'error',
          critical: true,
          details: aiKeyTest,
        },
      },
      environment: {
        deployment: process.env.CONVEX_CLOUD_URL || 'unknown',
        nodeVersion: process.version,
      },
      recommendations: getRecommendations({ checks }, aiKeyTest),
    };
  },
});

function getRecommendations(
  detailedCheck: {
    checks: Record<
      string,
      {
        status: 'ok' | 'missing' | 'empty';
        critical: boolean;
      }
    >;
  },
  aiKeyTest: {
    configured: boolean;
    valid: boolean;
    errorCode: string | null;
  }
): string[] {
  const recommendations: string[] = [];

  // Check for missing/empty environment variables
  const missingCritical = Object.entries(detailedCheck.checks)
    .filter(([, check]) => check.critical && check.status !== 'ok')
    .map(([name]) => name);

  if (missingCritical.length > 0) {
    recommendations.push(
      `Critical environment variables missing or empty: ${missingCritical.join(', ')}. ` +
        'Set them in Convex dashboard → Settings → Environment Variables.'
    );
  }

  // API key specific recommendations
  if (!aiKeyTest.configured) {
    recommendations.push(
      'GOOGLE_AI_API_KEY is not set. Quiz generation will fail. ' +
        'Set it in Convex production environment using: npx convex env set GOOGLE_AI_API_KEY "your-key" --prod'
    );
  } else if (!aiKeyTest.valid) {
    switch (aiKeyTest.errorCode) {
      case 'INVALID_KEY':
        recommendations.push(
          'GOOGLE_AI_API_KEY is invalid or expired. ' +
            'Generate a new key at https://aistudio.google.com/app/apikey ' +
            'and update it in Convex production environment.'
        );
        break;
      case 'RATE_LIMIT':
        recommendations.push(
          'Google AI API rate limit reached. Either wait for the limit to reset or upgrade your quota at https://console.cloud.google.com/apis/api/generativelanguage.googleapis.com/quotas'
        );
        break;
      case 'API_DISABLED':
        recommendations.push(
          'Google AI API is disabled for this key. Enable the Generative Language API in Google Cloud Console for your project.'
        );
        break;
      case 'NETWORK':
        recommendations.push(
          'Network connectivity issues reaching Google AI API. Check firewall rules, proxy settings, or wait for network recovery.'
        );
        break;
      default:
        recommendations.push(
          'Google AI API key test failed with an unknown error. Check Convex logs for details and verify your API key at https://aistudio.google.com/app/apikey'
        );
    }
  }

  if (recommendations.length === 0) {
    recommendations.push(
      'All backend services are healthy and operational. All functional tests passed.'
    );
  }

  return recommendations;
}
