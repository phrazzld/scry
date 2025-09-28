import { NextRequest, NextResponse } from 'next/server';

/**
 * Legacy redirect endpoint for backwards compatibility
 * Redirects from /api/generate-quiz to /api/generate-questions
 *
 * @deprecated This endpoint is deprecated. Please use /api/generate-questions instead.
 */

const DEPRECATION_MESSAGE =
  'This endpoint is deprecated. Please use /api/generate-questions instead.';
const NEW_ENDPOINT = '/api/generate-questions';

// Handle POST requests (the main method for quiz generation)
export async function POST(request: NextRequest) {
  // Get the base URL for the redirect
  const url = new URL(request.url);
  const redirectUrl = `${url.origin}${NEW_ENDPOINT}`;

  // Log deprecation warning in development
  if (process.env.NODE_ENV === 'development') {
    console.warn(`[DEPRECATED] POST ${url.pathname} → ${NEW_ENDPOINT}`);
  }

  // Clone the request body to forward it
  const body = await request.text();

  // Create response with redirect
  const response = await fetch(redirectUrl, {
    method: 'POST',
    headers: {
      'Content-Type': request.headers.get('Content-Type') || 'application/json',
      // Forward other relevant headers
      'User-Agent': request.headers.get('User-Agent') || '',
    },
    body: body,
  });

  // Get the response data
  const data = await response.json();

  // Return response with deprecation headers
  return NextResponse.json(data, {
    status: response.status,
    headers: {
      Deprecation: 'true',
      'X-Deprecation-Message': DEPRECATION_MESSAGE,
      'X-Alternative-Endpoint': NEW_ENDPOINT,
      Sunset: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toUTCString(), // 90 days from now
      Warning: `299 - "${DEPRECATION_MESSAGE}"`,
    },
  });
}

// Handle GET requests with deprecation notice
export async function GET() {
  return NextResponse.json(
    {
      error: 'Method not supported',
      message: DEPRECATION_MESSAGE,
      alternative: NEW_ENDPOINT,
    },
    {
      status: 405,
      headers: {
        Deprecation: 'true',
        'X-Deprecation-Message': DEPRECATION_MESSAGE,
        'X-Alternative-Endpoint': NEW_ENDPOINT,
        Allow: 'POST',
      },
    }
  );
}

// Handle OPTIONS requests for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      Allow: 'POST, OPTIONS',
      Deprecation: 'true',
      'X-Deprecation-Message': DEPRECATION_MESSAGE,
      'X-Alternative-Endpoint': NEW_ENDPOINT,
    },
  });
}
