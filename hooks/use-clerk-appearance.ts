'use client';

import { useMemo } from 'react';
import { useTheme } from 'next-themes';
import { dark } from '@clerk/themes';

const clerkElements = {
  card: 'bg-card text-card-foreground border border-border shadow-none',
  headerTitle: 'text-2xl font-semibold text-foreground',
  headerSubtitle: 'text-muted-foreground',
  socialButtons: 'gap-2',
  socialButtonsBlockButton:
    'bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border',
  socialButtonsIconButton:
    'bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border',
  formButtonPrimary:
    'bg-primary text-primary-foreground hover:bg-primary/90 transition-colors border border-primary',
  formFieldLabel: 'text-sm font-medium text-foreground',
  formFieldInput:
    'bg-input text-foreground border border-border focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/40 transition-colors',
  footerAction: 'text-sm text-muted-foreground',
  footerActionLink: 'text-primary hover:text-primary/80 font-medium',
  dividerText: 'text-muted-foreground',
  userButtonPopoverCard:
    'bg-card text-card-foreground border border-border shadow-lg shadow-black/10',
  userButtonPopoverActionButton:
    'text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors',
  userButtonPopoverActionButtonIcon: 'text-muted-foreground',
  userButtonPopoverFooter: 'border-t border-border',
} as const satisfies Record<string, string>;

const clerkVariables = {
  colorBackground: 'hsl(var(--card))',
  colorForeground: 'hsl(var(--foreground))',
  colorPrimary: 'hsl(var(--primary))',
  colorPrimaryForeground: 'hsl(var(--primary-foreground))',
  colorDanger: 'hsl(var(--destructive))',
  colorMuted: 'hsl(var(--muted))',
  colorMutedForeground: 'hsl(var(--muted-foreground))',
  colorText: 'hsl(var(--foreground))',
  colorTextSecondary: 'hsl(var(--muted-foreground))',
  colorBorder: 'hsl(var(--border))',
  colorRing: 'hsl(var(--ring))',
  colorInputBackground: 'hsl(var(--input))',
  colorInputText: 'hsl(var(--foreground))',
  borderRadius: 'var(--radius)',
  fontFamily: 'var(--font-sans)',
} as const satisfies Record<string, string>;

export function useClerkAppearance() {
  const { resolvedTheme } = useTheme();

  return useMemo(() => {
    const theme = resolvedTheme ?? 'light';

    return {
      baseTheme: theme === 'dark' ? dark : undefined,
      variables: clerkVariables,
      elements: clerkElements,
    };
  }, [resolvedTheme]);
}
