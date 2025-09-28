'use client';

import { SignIn } from '@clerk/nextjs';

/**
 * Landing page for unauthenticated users
 * Displays the Scry branding and Clerk sign-in component
 * Recreated after Clerk migration to restore the original UX
 */
export function SignInLanding() {
  return (
    <div className="flex-1 flex items-center justify-center px-6">
      <div className="w-full max-w-7xl">
        {/* Two-column layout on desktop, stacked on mobile */}
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          {/* Left: Branding */}
          <div>
            <h1 className="text-7xl md:text-8xl font-bold tracking-tight text-foreground">
              Scry<span className="opacity-70">.</span>
            </h1>

            {/* Larger tagline - now reads as subheading */}
            <p className="text-2xl md:text-3xl text-muted-foreground mt-4">Remember everything.</p>
          </div>

          {/* Right: Authentication */}
          <div className="flex justify-center lg:justify-end">
            <div className="w-full max-w-md">
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
    </div>
  );
}
