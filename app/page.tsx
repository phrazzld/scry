'use client';

import { useUser } from '@clerk/nextjs';

import { ReviewFlow } from '@/components/review-flow';
import { ReviewErrorBoundary } from '@/components/review/review-error-boundary';
import { SignInLanding } from '@/components/sign-in-landing';

export default function Home() {
  const { isSignedIn, isLoaded } = useUser();

  // Wait for auth to load
  if (!isLoaded) return null;

  // Show landing page for unauthenticated users
  if (!isSignedIn) {
    return <SignInLanding />;
  }

  // Show review flow for authenticated users
  return (
    <ReviewErrorBoundary
      fallbackMessage="Unable to load the review session. Please refresh to try again."
      onReset={() => {
        // Optional: Clear any cached state or perform cleanup
        if (typeof window !== 'undefined') {
          window.location.href = '/';
        }
      }}
    >
      <ReviewFlow />
    </ReviewErrorBoundary>
  );
}
