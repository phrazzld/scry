'use client';

import { useCallback, useEffect, useMemo } from 'react';
import { useUser } from '@clerk/nextjs';

import {
  clearUserContext,
  setUserContext,
  trackEvent,
  type AnalyticsEventName,
  type AnalyticsEventProperties,
} from '@/lib/analytics';

type TrackEventHandler = <Name extends AnalyticsEventName>(
  name: Name,
  properties?: AnalyticsEventProperties<Name>
) => void;

function buildUserMetadata(user: ReturnType<typeof useUser>['user']): Record<string, string> {
  if (!user) {
    return {};
  }

  const metadata: Record<string, string> = {};

  const email = user.primaryEmailAddress?.emailAddress;
  if (email) {
    metadata.email = email;
  }

  if (user.fullName) {
    metadata.name = user.fullName;
  }

  if (user.username) {
    metadata.username = user.username;
  }

  return metadata;
}

export function useTrackEvent(): TrackEventHandler {
  const { isSignedIn, user } = useUser();

  const memoizedMetadata = useMemo(() => buildUserMetadata(user), [
    user?.id,
    user?.fullName,
    user?.username,
    user?.primaryEmailAddress?.emailAddress,
  ]);

  useEffect(() => {
    if (isSignedIn && user?.id) {
      setUserContext(user.id, memoizedMetadata);
      return;
    }

    if (isSignedIn === false) {
      clearUserContext();
    }
  }, [isSignedIn, memoizedMetadata, user?.id]);

  return useCallback(<Name extends AnalyticsEventName>(
    name: Name,
    properties?: AnalyticsEventProperties<Name>
  ) => {
    trackEvent(name, properties);
  }, []);
}
