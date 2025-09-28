'use client';

import { SignIn } from '@clerk/nextjs';

/**
 * Landing page for unauthenticated users
 * Displays the Scry branding and Clerk sign-in component
 * Recreated after Clerk migration to restore the original UX
 */
export function SignInLanding() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="w-full max-w-5xl">
        <div className="max-w-3xl">
          {/* Brand title with minimal aesthetic */}
          <h1 className="text-7xl md:text-8xl font-bold tracking-tight text-foreground">
            Scry<span className="opacity-70">.</span>
          </h1>

          {/* Tagline */}
          <p className="text-xl text-muted-foreground mt-4 mb-16">Remember everything.</p>

          {/* Clerk SignIn component with custom styling to match the minimal design */}
          <div className="max-w-md">
            <SignIn
              routing="hash"
              appearance={{
                elements: {
                  rootBox: 'mx-0',
                  card: 'shadow-none border p-0 bg-transparent',
                  headerTitle: 'hidden',
                  headerSubtitle: 'hidden',
                  socialButtonsBlockButton: 'border-border',
                  dividerRow: 'hidden',
                  formButtonPrimary: 'bg-primary hover:bg-primary/90',
                  footerActionLink: 'text-primary hover:text-primary/80',
                  identityPreviewEditButtonIcon: 'text-muted-foreground',
                  formFieldInput: 'border-border',
                  formFieldLabel: 'text-foreground',
                  identityPreviewText: 'text-foreground',
                  identityPreviewSecondaryText: 'text-muted-foreground',
                },
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
