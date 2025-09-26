import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { validateEnv } from "@/lib/env";

// Validate environment variables at build/dev time
if (process.env.NODE_ENV === "development") {
  validateEnv();
}

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Scry - Simple Learning",
  description: "Transform any topic into quiz questions with AI",
};

import { ConditionalNavbar } from '@/components/conditional-navbar'
import { Footer } from '@/components/footer'
import { Toaster } from '@/components/ui/sonner'
import { ClerkConvexProvider } from './clerk-provider'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/react'
import { getLayoutClassName, needsNavbarSpacer } from '@/lib/layout-mode'
import { ThemeProvider } from '@/components/theme-provider'
import { DebugPanel } from '@/components/debug-panel'

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <ClerkConvexProvider>
            <div className={getLayoutClassName()}>
              <ConditionalNavbar />
              {needsNavbarSpacer() && <div className="h-16" />}
              <main>{children}</main>
              <Footer />
            </div>
            <Toaster />
            <DebugPanel />
            <Analytics />
            <SpeedInsights />
          </ClerkConvexProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}