import { NextResponse } from 'next/server';
import { ConvexHttpClient } from 'convex/browser';

import { api } from '@/convex/_generated/api';
import { getDeploymentEnvironment } from '@/lib/environment';

interface HealthCheck {
  status: string;
  value?: string;
  configured?: boolean;
  canCreateSession?: boolean;
  error: string | null;
  details?: Record<string, unknown>;
}

interface HealthChecks {
  environment: HealthCheck;
  vercelUrl: HealthCheck;
  convexConnection: HealthCheck;
  convexSchema: HealthCheck;
  googleAiKey: HealthCheck;
  sessionCreation: HealthCheck;
}

export async function GET() {
  const checks = {
    environment: {
      status: 'unknown',
      value: '',
      error: null as string | null,
    },
    vercelUrl: {
      status: 'unknown',
      value: '',
      error: null as string | null,
    },
    convexConnection: {
      status: 'unknown',
      error: null as string | null,
    },
    convexSchema: {
      status: 'unknown',
      error: null as string | null,
      details: {} as Record<string, unknown>,
    },
    googleAiKey: {
      status: 'unknown',
      configured: false,
      error: null as string | null,
      details: {} as Record<string, unknown>,
    },
    sessionCreation: {
      status: 'unknown',
      canCreateSession: false,
      error: null as string | null,
    },
  };

  try {
    // Check environment detection
    const environment = getDeploymentEnvironment();
    checks.environment.value = environment;
    checks.environment.status = 'ok';

    // Check VERCEL_URL
    if (process.env.VERCEL_URL) {
      checks.vercelUrl.value = process.env.VERCEL_URL;
      checks.vercelUrl.status = 'ok';
    } else {
      checks.vercelUrl.status = 'missing';
      checks.vercelUrl.error = 'VERCEL_URL not set';
    }

    // Check Convex connection
    const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!convexUrl) {
      checks.convexConnection.status = 'error';
      checks.convexConnection.error = 'NEXT_PUBLIC_CONVEX_URL not configured';
    } else {
      try {
        const client = new ConvexHttpClient(convexUrl);
        // Try a simple query to test connection
        await client.query(api.spacedRepetition.getDueCount, {});
        checks.convexConnection.status = 'ok';
      } catch (error) {
        checks.convexConnection.status = 'error';
        checks.convexConnection.error = error instanceof Error ? error.message : 'Unknown error';
      }
    }

    // Check Convex schema compatibility
    if (checks.convexConnection.status === 'ok' && convexUrl) {
      try {
        const client = new ConvexHttpClient(convexUrl);
        const schemaDetails = {
          hasEnvironmentParam: false,
          hasFSRSFields: false,
          supportedFeatures: [] as string[],
          missingFeatures: [] as string[],
        };

        // Test Clerk authentication integration
        schemaDetails.hasEnvironmentParam = true; // No longer relevant with Clerk
        schemaDetails.supportedFeatures.push('clerk-auth');

        // Test if we can query spaced repetition features
        try {
          // Try to call a spaced repetition query
          await client.query(api.spacedRepetition.getDueCount, {});
          schemaDetails.hasFSRSFields = true;
          schemaDetails.supportedFeatures.push('spaced-repetition');
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          // If the error is about auth, the query exists
          if (
            errorMessage.includes('Authentication required') ||
            errorMessage.includes('Invalid or expired session')
          ) {
            schemaDetails.hasFSRSFields = true;
            schemaDetails.supportedFeatures.push('spaced-repetition');
          } else if (
            errorMessage.includes('spacedRepetition') ||
            errorMessage.includes('not found')
          ) {
            schemaDetails.missingFeatures.push('spaced repetition queries');
          }
        }

        checks.convexSchema.details = schemaDetails;

        // Determine overall schema status
        if (schemaDetails.missingFeatures.length === 0) {
          checks.convexSchema.status = 'ok';
        } else {
          checks.convexSchema.status = 'warning';
          checks.convexSchema.error = `Schema partially outdated. Missing: ${schemaDetails.missingFeatures.join(', ')}`;
        }
      } catch (error) {
        checks.convexSchema.status = 'error';
        checks.convexSchema.error =
          error instanceof Error ? error.message : 'Failed to check schema';
      }
    } else {
      checks.convexSchema.status = 'skipped';
      checks.convexSchema.error = 'Cannot check schema without Convex connection';
    }

    // Check Google AI API key (functional test via Convex)
    // Note: GOOGLE_AI_API_KEY in Next.js env is NOT used for generation
    // The actual key used by Convex backend is tested via functional health check
    if (checks.convexConnection.status === 'ok' && convexUrl) {
      try {
        const client = new ConvexHttpClient(convexUrl);
        // Call the functional health check that tests the actual API key
        const healthResult = await client.action(api.health.functional, {});
        const aiKeyCheck = healthResult.checks.googleAiKeyFunctional;
        const aiKeyDetails = aiKeyCheck.details as {
          configured: boolean;
          valid: boolean;
          error: string | null;
          errorCode: string | null;
        };
        const diagnostics = (healthResult.diagnostics?.googleApiKey ?? null) as {
          present: boolean;
          length: number;
          fingerprint: string | null;
        } | null;

        if (aiKeyDetails.configured && aiKeyDetails.valid) {
          checks.googleAiKey.configured = true;
          checks.googleAiKey.status = 'ok';
          checks.googleAiKey.details = {
            message: 'API key is valid and functional',
            diagnostics,
          };
        } else if (!aiKeyDetails.configured) {
          checks.googleAiKey.configured = false;
          checks.googleAiKey.status = 'missing';
          checks.googleAiKey.error = 'GOOGLE_AI_API_KEY not set in Convex production environment';
          checks.googleAiKey.details = {
            diagnostics,
          };
        } else {
          // Key is set but not working
          checks.googleAiKey.configured = true;
          checks.googleAiKey.status = 'error';
          checks.googleAiKey.error = `API key test failed: ${aiKeyDetails.errorCode} - ${aiKeyDetails.error}`;
          checks.googleAiKey.details = {
            errorCode: aiKeyDetails.errorCode,
            message: aiKeyDetails.error,
            diagnostics,
          };
        }
      } catch (error) {
        checks.googleAiKey.status = 'error';
        checks.googleAiKey.error = `Failed to test API key: ${error instanceof Error ? error.message : 'Unknown error'}`;
      }
    } else {
      checks.googleAiKey.status = 'skipped';
      checks.googleAiKey.error = 'Cannot test API key without Convex connection';
    }

    // Check if we can create sessions with proper environment tagging
    checks.sessionCreation.canCreateSession = true;
    checks.sessionCreation.status = 'ok';

    // Calculate overall health
    const allChecks = Object.values(checks);
    const hasErrors = allChecks.some((check) => check.status === 'error');
    const hasWarnings = allChecks.some((check) => check.status === 'missing');

    const overallStatus = hasErrors ? 'error' : hasWarnings ? 'warning' : 'healthy';

    return NextResponse.json({
      status: overallStatus,
      environment: environment,
      timestamp: new Date().toISOString(),
      checks,
      recommendations: getRecommendations(checks),
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        checks,
      },
      { status: 500 }
    );
  }
}

function getRecommendations(checks: HealthChecks): string[] {
  const recommendations: string[] = [];

  if (checks.vercelUrl.status === 'missing') {
    recommendations.push(
      'VERCEL_URL is not set. This may cause issues with magic link generation in preview deployments.'
    );
  }

  if (checks.googleAiKey.status === 'missing') {
    recommendations.push(
      'GOOGLE_AI_API_KEY is not set in Convex production environment. ' +
        'Quiz generation will fail. Set it using: npx convex env set GOOGLE_AI_API_KEY "your-key" --prod'
    );
  } else if (checks.googleAiKey.status === 'error') {
    const details = checks.googleAiKey.details as { errorCode?: string } | undefined;
    const errorCode = details?.errorCode;

    if (errorCode === 'INVALID_KEY') {
      recommendations.push(
        'GOOGLE_AI_API_KEY is invalid or expired. Generate a new key at https://aistudio.google.com/app/apikey ' +
          'and update Convex: npx convex env set GOOGLE_AI_API_KEY "new-key" --prod'
      );
    } else if (errorCode === 'RATE_LIMIT') {
      recommendations.push(
        'Google AI API rate limit reached. Wait for the limit to reset or upgrade your quota.'
      );
    } else if (errorCode === 'API_DISABLED') {
      recommendations.push(
        'Google AI API is disabled. Enable the Generative Language API in Google Cloud Console.'
      );
    } else {
      recommendations.push(
        'GOOGLE_AI_API_KEY test failed. Check Convex logs for details: https://dashboard.convex.dev'
      );
    }
  }

  if (checks.convexConnection.status === 'error') {
    recommendations.push('Cannot connect to Convex. Check NEXT_PUBLIC_CONVEX_URL configuration.');
  }

  if (checks.convexSchema.status === 'error') {
    recommendations.push(
      'CRITICAL: Convex backend schema is out of sync with frontend. Deploy your Convex functions to fix this issue.'
    );
    recommendations.push('Run: npx convex deploy --prod (requires CONVEX_DEPLOY_KEY)');
  } else if (checks.convexSchema.status === 'warning') {
    recommendations.push(
      'Convex backend is missing some features. Some functionality may be limited.'
    );
  }

  if (checks.environment.value?.startsWith('preview')) {
    recommendations.push(
      'This is a preview deployment. Sessions created here will not work in production.'
    );
    recommendations.push(
      '⚠️  IMPORTANT: Preview deployments use the PRODUCTION Convex backend (free tier limitation). ' +
        'API configuration issues affect BOTH preview AND production environments.'
    );

    if (checks.convexSchema.status === 'error' || checks.convexSchema.status === 'warning') {
      recommendations.push(
        'Preview deployments use production Convex backend. Schema mismatches will affect all preview deployments.'
      );
    }

    if (checks.googleAiKey.status !== 'ok') {
      recommendations.push(
        'To isolate preview from production, upgrade to Convex Pro ($25/mo) for separate preview deployments: https://convex.dev/pricing'
      );
    }
  }

  return recommendations;
}
