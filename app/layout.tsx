import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { AnalyticsWrapper } from '@/components/analytics-wrapper';
import { ConditionalNavbar } from '@/components/conditional-navbar';
import { ConvexErrorBoundary } from '@/components/convex-error-boundary';
import { DeploymentVersionGuard } from '@/components/deployment-version-guard';
import { Footer } from '@/components/footer';
import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from '@/components/ui/sonner';
import { CurrentQuestionProvider } from '@/contexts/current-question-context';
import { ConfirmationProvider } from '@/hooks/use-confirmation';
import { validateEnv } from '@/lib/env';
import { getLayoutClassName, needsNavbarSpacer } from '@/lib/layout-mode';
import { ClerkConvexProvider } from './clerk-provider';

// Validate environment variables at build/dev time
if (process.env.NODE_ENV === 'development') {
  validateEnv();
}

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Scry - Simple Learning',
  description: 'Transform any topic into quiz questions with AI',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <ConfirmationProvider>
            <ClerkConvexProvider>
              <ConvexErrorBoundary>
                <DeploymentVersionGuard>
                  <CurrentQuestionProvider>
                    <div className={getLayoutClassName()}>
                      <ConditionalNavbar />
                      {needsNavbarSpacer() && <div className="h-16" />}
                      <main>{children}</main>
                      <Footer />
                    </div>
                    <Toaster />
                    <AnalyticsWrapper />
                    <SpeedInsights />
                  </CurrentQuestionProvider>
                </DeploymentVersionGuard>
              </ConvexErrorBoundary>
            </ClerkConvexProvider>
          </ConfirmationProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
