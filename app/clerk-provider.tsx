'use client';

import { useEffect, useState } from 'react';
import { ClerkProvider, useAuth, useUser } from '@clerk/nextjs';
import { ConvexReactClient, useMutation } from 'convex/react';
import { ConvexProviderWithClerk } from 'convex/react-clerk';

import { api } from '@/convex/_generated/api';
import { useClerkAppearance } from '@/hooks/use-clerk-appearance';

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

function ThemedClerkProvider({ children }: { children: React.ReactNode }) {
  const appearance = useClerkAppearance();

  return (
    <ClerkProvider
      publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY!}
      appearance={appearance}
    >
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        <EnsureConvexUser>{children}</EnsureConvexUser>
      </ConvexProviderWithClerk>
    </ClerkProvider>
  );
}

export function ClerkConvexProvider({ children }: { children: React.ReactNode }) {
  return <ThemedClerkProvider>{children}</ThemedClerkProvider>;
}

function EnsureConvexUser({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn } = useUser();
  const ensureUser = useMutation(api.clerk.ensureUser);
  const [hasEnsured, setHasEnsured] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!isLoaded) {
      setReady(false);
      return;
    }

    if (!isSignedIn) {
      setHasEnsured(false);
      setReady(true);
      return;
    }

    if (hasEnsured) {
      setReady(true);
      return;
    }

    setReady(false);
    let cancelled = false;

    void (async () => {
      try {
        await ensureUser();
        if (!cancelled) {
          setHasEnsured(true);
          setReady(true);
        }
      } catch (error) {
        console.error('Failed to ensure Convex user', error);
        if (!cancelled) {
          setReady(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ensureUser, hasEnsured, isLoaded, isSignedIn]);

  if (!ready) {
    return null;
  }

  return <>{children}</>;
}
