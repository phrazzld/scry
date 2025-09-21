# SPEC: Dark Mode Implementation

*"Simplicity is prerequisite for reliability." - Edsger W. Dijkstra*

## Invariants

These conditions MUST hold at all times:

### I1: Theme State Consistency
```
∀t ∈ Time, ∀w ∈ Windows:
  theme(w, t) ∈ {'light', 'dark', 'system'} ∧
  resolvedTheme(w, t) ∈ {'light', 'dark'}
```

### I2: No Flash of Unstyled Content (FOUC)
```
∀pageLoad:
  renderTime(themeApplication) < renderTime(firstPaint)
```

### I3: Multi-Tab Synchronization
```
∀t1, t2 ∈ Tabs, ∀changeEvent:
  setTheme(t1, theme) → theme(t2, t + δ) = theme
  where δ < 100ms
```

### I4: Accessibility Compliance
```
∀element ∈ DOM:
  contrastRatio(foreground(element), background(element)) ≥ 4.5:1
```

### I5: Performance Boundary
```
∀themeSwitch:
  timeToComplete(themeSwitch) < 16ms ∧
  reflows(themeSwitch) = 1
```

## Requirements

### Functional

- [ ] **F1**: System detects and respects `prefers-color-scheme` media query
- [ ] **F2**: User can manually override system preference
- [ ] **F3**: Theme preference persists across sessions
- [ ] **F4**: Theme applies before first paint (zero FOUC)
- [ ] **F5**: Theme changes propagate to all open tabs
- [ ] **F6**: CSS variables update atomically for all themed properties

### Non-Functional

- [ ] **N1**: Bundle size increase < 5KB gzipped
- [ ] **N2**: Theme switch completes in single animation frame (16ms)
- [ ] **N3**: Zero JavaScript execution for initial theme application
- [ ] **N4**: Works with Content Security Policy (no inline styles)
- [ ] **N5**: WCAG AAA contrast ratio (7:1) for critical text

## Constraints

### Technical
- **C1**: Must use existing `next-themes` library (already installed)
- **C2**: Must preserve existing CSS variable architecture
- **C3**: Must work with Tailwind CSS v4 `@custom-variant` syntax
- **C4**: Must support Next.js 15 App Router with RSC
- **C5**: Cannot modify Convex backend (theme is client-only preference)

### Security
- **S1**: Theme values restricted to enum: `{'light', 'dark', 'system'}`
- **S2**: No user-provided CSS injection possible
- **S3**: localStorage access wrapped in try-catch for sandboxed iframes

### Resource
- **R1**: Single reflow per theme change
- **R2**: No network requests for theme switching
- **R3**: Maximum 100ms delay for cross-tab sync

## Implementation Strategy

### Phase 1: Core Infrastructure (Blocking)

1. **Inline Script Injection**
   ```typescript
   // Precondition: document.documentElement exists
   // Postcondition: data-theme attribute set before CSS loads
   ```

2. **CSS Variable Dark Mode Definitions**
   ```css
   /* Precondition: :root variables exist
      Postcondition: .dark class overrides all color variables */
   ```

3. **Theme Provider Integration**
   ```typescript
   // Precondition: next-themes installed
   // Postcondition: React context provides theme state
   ```

### Phase 2: User Interface

4. **Theme Toggle Component**
   ```typescript
   // Precondition: Theme context available
   // Postcondition: User can switch between light/dark/system
   ```

5. **Hydration Safety**
   ```typescript
   // Precondition: SSR/CSR mismatch possible
   // Postcondition: suppressHydrationWarning on <html>
   ```

### Phase 3: Polish & Verification

6. **Transition Animations**
   ```css
   /* Only on color properties, not layout */
   transition: background-color 200ms, color 200ms;
   ```

7. **Accessibility Audit**
   - Verify all text meets WCAG contrast requirements
   - Test with screen readers
   - Ensure focus indicators visible in both themes

## Success Criteria

### Automated Tests
- [ ] Theme applies in < 1ms on page load
- [ ] No hydration warnings in console
- [ ] localStorage persistence verified
- [ ] Cross-tab sync completes in < 100ms

### Manual Verification
- [ ] No FOUC on hard refresh (Cmd+Shift+R)
- [ ] No FOUC with network throttling (Slow 3G)
- [ ] Theme persists across browser restart
- [ ] System preference changes auto-update when theme='system'

### Performance Metrics
```
Lighthouse Score Impact: < 1 point reduction
First Contentful Paint: No regression
Cumulative Layout Shift: 0 during theme switch
Bundle Size Delta: < 5KB gzipped
```

## Edge Cases

### E1: localStorage Unavailable
```typescript
if (!window.localStorage) {
  // Fallback to system preference only
  // No persistence, but no errors
}
```

### E2: Malformed localStorage Data
```typescript
try {
  theme = localStorage.getItem('theme')
  if (!['light', 'dark', 'system'].includes(theme)) {
    theme = 'system' // Safe default
  }
} catch {
  theme = 'system'
}
```

### E3: Rapid Theme Switching
```typescript
// Debounce at 50ms to prevent animation jank
// Last switch wins
```

### E4: Print Media
```css
@media print {
  /* Force light theme for printing */
  * {
    color-scheme: light !important;
    -webkit-print-color-adjust: exact;
  }
}
```

## Implementation Checklist

### Setup (5 minutes)
- [ ] Add suppressHydrationWarning to <html> element
- [ ] Create components/theme-provider.tsx wrapper
- [ ] Add ThemeProvider to root layout

### Core Implementation (15 minutes)
- [ ] Define dark mode CSS variables in globals.css
- [ ] Configure Tailwind @custom-variant dark
- [ ] Implement inline script for FOUC prevention
- [ ] Create theme toggle component

### Verification (10 minutes)
- [ ] Test hard refresh (no FOUC)
- [ ] Test cross-tab synchronization
- [ ] Verify accessibility contrast ratios
- [ ] Check bundle size impact

### Documentation (5 minutes)
- [ ] Update CLAUDE.md with theme conventions
- [ ] Add theme toggle to navbar
- [ ] Document CSS variable naming

## Proof of Correctness

Given:
- `next-themes` handles localStorage and cross-tab sync
- Inline script runs before React hydration
- CSS variables provide atomic updates
- Tailwind dark variant provides consistent API

Therefore:
- All invariants I1-I5 are maintained
- All functional requirements F1-F6 are satisfied
- All non-functional requirements N1-N5 are met

QED.

---

*"The question of whether a computer can think is no more interesting than the question of whether a submarine can swim." - Edsger W. Dijkstra*

The above specification describes not what we wish to build, but what must work.