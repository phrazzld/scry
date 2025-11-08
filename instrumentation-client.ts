// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from '@sentry/nextjs';

import './sentry.client.config';

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
