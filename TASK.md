# Dark Mode Implementation Research - 2025 Best Practices

This document contains research findings on current best practices for implementing dark mode in Next.js applications, focusing on production-ready, performance-optimized solutions.

## Executive Summary

The most robust dark mode implementation for 2025 uses **CSS Custom Properties (Variables)** with a class-based toggle system, Next.js SSR-compatible initialization, and strict security measures. The `next-themes` library represents the gold standard for this implementation pattern.

## Core Architecture (Recommended Approach)

### 1. CSS Variables Foundation
Use CSS custom properties as the foundation for theme switching:

```css
/* globals.css */
:root {
  --background: #ffffff;
  --foreground: #000000;
  --card: #f8f9fa;
  --border: #e9ecef;
  --primary: #0066cc;
  --muted: #6c757d;
}

/* Respect system preference first */
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --background: #0d1117;
    --foreground: #c9d1d9;
    --card: #161b22;
    --border: #30363d;
    --primary: #58a6ff;
    --muted: #8b949e;
  }
}

/* Manual override for dark theme */
[data-theme="dark"] {
  --background: #0d1117;
  --foreground: #c9d1d9;
  --card: #161b22;
  --border: #30363d;
  --primary: #58a6ff;
  --muted: #8b949e;
}

/* Apply variables to elements */
body {
  background-color: var(--background);
  color: var(--foreground);
  transition: background-color 0.3s ease, color 0.3s ease;
}
```

### 2. FOUC Prevention (Critical)
Prevent flash of unstyled content with an inline render-blocking script:

```html
<!-- In <head> before any CSS -->
<script>
  (function() {
    try {
      var theme = localStorage.getItem('theme');
      if (theme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
        document.documentElement.style.colorScheme = 'dark';
      } else if (theme === 'light') {
        document.documentElement.setAttribute('data-theme', 'light');
        document.documentElement.style.colorScheme = 'light';
      } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        document.documentElement.setAttribute('data-theme', 'dark');
        document.documentElement.style.colorScheme = 'dark';
      }
    } catch (e) { /* Ignore */ }
  })();
</script>
```

### 3. Next.js Implementation Pattern

**Theme Provider (app/theme-provider.tsx):**
```typescript
'use client'

import * as React from 'react'
import { ThemeProvider as NextThemesProvider } from 'next-themes'
import { type ThemeProviderProps } from 'next-themes/dist/types'

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>
}
```

**Root Layout (app/layout.tsx):**
```tsx
import './globals.css'
import { ThemeProvider } from './theme-provider'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider
          attribute="data-theme"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange={false}
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
```

**Theme Switcher Component:**
```tsx
'use client'

import * as React from 'react'
import { Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'

export function ThemeSwitcher() {
  const { setTheme, theme } = useTheme()

  return (
    <button
      onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
      className="p-2 rounded-md"
    >
      <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      <span className="sr-only">Toggle theme</span>
    </button>
  )
}
```

## Security Considerations

### 1. XSS Prevention
- **Use Allow-Lists**: Only accept `['light', 'dark', 'system']` as valid theme values
- **Sanitize All Inputs**: Treat localStorage, cookies, and URL parameters as untrusted
- **Avoid Direct DOM Manipulation**: Use well-vetted libraries like `next-themes`

### 2. Content Security Policy (CSP)
Configure strict CSP that works with class-based theme switching:

```javascript
// next.config.mjs
const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: "default-src 'self'; style-src 'self'; script-src 'self'; img-src 'self' data:; font-src 'self';",
  },
];
```

### 3. Storage Security
- **localStorage Only for Preferences**: Never store sensitive data
- **Validate on Read**: Always validate data from localStorage before use
- **Consider Cookie Alternatives**: Use the inline script approach instead of cookies

## Common Failure Modes & Solutions

### 1. Flash of Unstyled Content (FOUC)
**Problem**: Default theme appears briefly before correct theme loads
**Solution**: Inline render-blocking script in `<head>`
**Debug**: Use network throttling to make FOUC visible

### 2. Hydration Mismatches
**Problem**: Server renders different theme than client expects
**Solution**: Use `suppressHydrationWarning` selectively and ensure inline script runs before React hydration
**Debug**: Check browser console for hydration warnings

### 3. Performance Issues
**Problem**: Theme switching causes lag or broken animations
**Solution**: Use CSS variables, single point of truth (one attribute change), smooth transitions
**Debug**: Use Performance profiler to identify style recalculation bottlenecks

### 4. Accessibility Problems
**Problem**: Poor color contrast, missing focus states
**Solution**: Use contrast checkers, test with WCAG standards (4.5:1 ratio minimum)
**Debug**: Use browser accessibility inspector and axe-core

### 5. Multi-Tab Sync Issues
**Problem**: Theme changes don't sync across open tabs
**Solution**: Listen to `storage` event for localStorage changes
**Debug**: Open multiple tabs and test theme switching

## Performance Optimization

### CSS Variables vs Class-Based Switching
- **Winner**: CSS Variables (better performance, less code duplication)
- **Mechanism**: Single attribute change triggers variable updates
- **Transitions**: Apply to paint-only properties (`color`, `background-color`)

### Bundle Size Impact
- **Minimal Impact**: Both approaches have similar bundle sizes when optimized
- **Best Practice**: Define light theme as default, dark as overrides
- **Media Query First**: Use `prefers-color-scheme` for system respect

### Mobile Considerations
- **OLED Optimization**: Use true black (`#000000`) for battery savings
- **Performance Critical**: Single point of truth prevents thrashing
- **Keep Simple**: Fewer property changes = faster switching

## Architecture Decisions for Scry

Based on this research, the recommended implementation for Scry:

1. **Use `next-themes`** - Industry standard, handles edge cases
2. **CSS Variables** - Performance and maintainability benefits
3. **Tailwind Integration** - Configure `darkMode: 'class'` in tailwind.config.js
4. **System Preference First** - Respect user's OS setting by default
5. **Manual Override** - Allow explicit light/dark selection
6. **Security Focus** - Strict validation, no custom CSS injection
7. **Accessibility Priority** - Proper contrast ratios, focus states

## Implementation Checklist

- [ ] Install and configure `next-themes`
- [ ] Set up CSS variables in globals.css
- [ ] Add theme provider to root layout
- [ ] Create theme switcher component
- [ ] Configure Tailwind for dark mode
- [ ] Add inline script for FOUC prevention
- [ ] Test accessibility with contrast checkers
- [ ] Verify multi-tab synchronization
- [ ] Performance test on mobile devices
- [ ] Security review of theme handling

## References

- [next-themes Documentation](https://github.com/pacocoursey/next-themes)
- [WCAG Color Contrast Guidelines](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html)
- [CSS Custom Properties Specification](https://www.w3.org/TR/css-variables-1/)
- [prefers-color-scheme Media Query](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-color-scheme)
