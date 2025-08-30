# CSS Grid Layout System

## Overview

Scry uses a CSS Grid-based layout system that provides a robust, flexible foundation for all application layouts. The system prevents content overlap, ensures proper spacing, and works seamlessly across all device sizes.

## Architecture Design

### Core Layout Structure

The layout system uses a simple three-row CSS Grid template:

```css
.layout-grid {
  display: grid;
  grid-template-rows: auto 1fr auto;
  min-height: 100vh;
  min-height: 100dvh; /* Dynamic viewport height for mobile */
}
```

**Grid Template Breakdown:**
- `auto` (Row 1): Header/Navbar - takes only the space it needs
- `1fr` (Row 2): Main content area - expands to fill remaining space
- `auto` (Row 3): Footer - takes only the space it needs

### HTML Structure

```tsx
<div className="layout-grid">
  <ConditionalNavbar />      {/* Grid row 1: auto */}
  <main>{children}</main>    {/* Grid row 2: 1fr */}
  <Footer />                 {/* Grid row 3: auto */}
</div>
```

## Key Benefits

### 1. Content Overlap Prevention
- **Architectural Solution**: CSS Grid inherently prevents content overlap by design
- **No Manual Spacing**: Eliminates need for margin calculations or spacer elements
- **Perfect CLS Score**: Achieves Cumulative Layout Shift score of 0

### 2. Mobile Viewport Optimization
- **Dynamic Viewport Height**: Uses `100dvh` fallback for mobile browsers
- **Safari Mobile Fix**: Handles Safari's dynamic URL bar behavior
- **Consistent Height**: Maintains full viewport height across all devices

### 3. Flexible Content Areas
- **Auto-sizing Header**: Navbar can change height without breaking layout
- **Expanding Main**: Content area automatically fills available space
- **Minimal Footer**: Footer takes only the space it needs

## Component Integration

### Navbar Component
**File**: `components/navbar.tsx`

```tsx
<nav className="sticky top-0 z-40 bg-white border-b border-gray-200">
  <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
    {/* Navbar content */}
  </div>
</nav>
```

**Key Features:**
- `sticky top-0`: Stays at top during scroll
- `z-40`: Ensures navbar appears above content
- `max-w-7xl mx-auto`: Centered with maximum width constraint
- `px-4 py-4`: Consistent horizontal and vertical padding

### Conditional Navbar
**File**: `components/conditional-navbar.tsx`

The navbar is conditionally rendered based on the current route:
- **Homepage** (`/`): No navbar (clean landing page)
- **All other pages**: Full navbar with user menu and navigation

### Footer Component  
**File**: `components/footer.tsx`

```tsx
<footer className="bg-white border-t border-gray-200">
  <div className="max-w-7xl mx-auto px-4 md:px-8 py-4">
    {/* Footer content */}
  </div>
</footer>
```

**Key Features:**
- No positioning classes needed (Grid handles placement)
- Responsive padding: `px-4` mobile, `px-8` desktop
- Consistent max-width and centering pattern

## Responsive Design Patterns

### Container Pattern
**Consistent across all components:**

```css
.container-pattern {
  max-width: 90rem; /* 1440px */
  margin: 0 auto;
  padding: 0 1rem; /* Mobile: 16px */
}

@media (min-width: 768px) {
  .container-pattern {
    padding: 0 2rem; /* Desktop: 32px */
  }
}
```

**Tailwind Implementation:**
```tsx
<div className="max-w-7xl mx-auto px-4 md:px-8">
  {/* Component content */}
</div>
```

### Spacing Scale
**Defined in `globals.css`:**

```css
:root {
  --spacing-prose: 1.5em;      /* Text content spacing */
  --spacing-section: 4rem;     /* Major section spacing */
  --spacing-component: 2rem;   /* Component spacing */
}
```

### Responsive Typography
**Navbar title example:**

```tsx
<Link href="/" className="text-2xl md:text-3xl font-bold">
  Scry.
</Link>
```

**Breakpoint**: `md:text-3xl` applies at 768px and up

## Implementation Details

### CSS Grid Safeguards

```css
.layout-grid > * {
  /* Ensure grid children respect layout boundaries */
  min-width: 0;
}
```

**Purpose**: Prevents grid items from overflowing their containers, especially important for text content and images.

### Viewport Height Handling

```css
.layout-grid {
  min-height: 100vh;       /* Standard viewport height */
  min-height: 100dvh;      /* Dynamic viewport height */
}
```

**Mobile Safari Consideration**: The `100dvh` unit accounts for Safari's dynamic URL bar that changes the viewport height during scrolling.

### Print Styles Integration

```css
@media print {
  .layout-grid {
    display: block; /* Falls back to normal flow for printing */
  }
}
```

## Performance Characteristics

### Layout Stability
- **Zero Layout Shift**: Perfect CLS (Cumulative Layout Shift) score of 0
- **Predictable Positioning**: Grid template prevents unexpected content movement
- **No Reflow Calculations**: Browser handles layout efficiently with CSS Grid

### Mobile Performance
- **Single Layout Pass**: CSS Grid requires fewer browser layout calculations
- **Hardware Acceleration**: Modern browsers optimize CSS Grid rendering
- **Memory Efficient**: No JavaScript needed for layout positioning

## Class Naming Conventions

### Layout Classes

| Class | Purpose | Location |
|-------|---------|----------|
| `.layout-grid` | Primary CSS Grid container | `app/layout.tsx` |
| `.prose` | Constrained width content wrapper | `globals.css` |
| `.doc-layout` | Documentation-specific layout wrapper | `globals.css` |

### Component Classes

| Pattern | Example | Purpose |
|---------|---------|---------|
| Container | `max-w-7xl mx-auto px-4` | Centered responsive containers |
| Sticky | `sticky top-0 z-40` | Sticky positioning with z-index |
| Border | `border-t border-gray-200` | Consistent border styling |
| Spacing | `px-4 md:px-8 py-4` | Responsive padding patterns |

## Browser Support

### CSS Grid Support
- **Modern Browsers**: Full support (Chrome 57+, Firefox 52+, Safari 10.1+)
- **Legacy Fallback**: Falls back to block layout for unsupported browsers
- **Mobile**: Excellent support across iOS Safari and Android Chrome

### Dynamic Viewport Units
- **dvh Support**: Chrome 108+, Safari 15.4+, Firefox 101+
- **Fallback**: Standard `vh` units for older browsers

## Migration Guide

### From Fixed Positioning

**Before (Fixed navbar):**
```css
.navbar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 50;
}

.main-content {
  margin-top: 80px; /* Manual spacing */
}
```

**After (CSS Grid):**
```css
.layout-grid {
  display: grid;
  grid-template-rows: auto 1fr auto;
}

.navbar {
  position: sticky;
  top: 0;
  z-index: 40;
}

/* No manual spacing needed */
```

### Benefits of Migration
1. **Eliminated Manual Spacing**: No need to calculate header heights
2. **Improved Mobile Experience**: Dynamic viewport height handling
3. **Better Performance**: Reduced layout thrashing
4. **Simplified CSS**: Less positioning complexity

## Troubleshooting

### Common Issues

**Content Overflow:**
```css
/* Fix: Add to grid children */
.grid-item {
  min-width: 0;
  overflow-wrap: break-word;
}
```

**Mobile Safari Viewport:**
```css
/* Fix: Use both vh and dvh */
.layout-grid {
  min-height: 100vh;
  min-height: 100dvh;
}
```

**Z-index Conflicts:**
```css
/* Standard z-index scale */
.navbar { z-index: 40; }
.modal { z-index: 50; }
.toast { z-index: 60; }
```

### Debugging Grid Layout

**Browser DevTools:**
1. Enable CSS Grid overlay in Chrome/Firefox DevTools
2. Inspect `.layout-grid` element
3. Verify three rows: `auto`, `1fr`, `auto`

**CSS Debug Utility:**
```css
.debug-grid {
  outline: 2px solid red;
}

.debug-grid > * {
  outline: 1px solid blue;
}
```

## Future Considerations

### CSS Container Queries
When broadly supported, container queries could enhance responsive behavior:

```css
@container (min-width: 768px) {
  .navbar-title {
    font-size: 1.875rem; /* Equivalent to text-3xl */
  }
}
```

### CSS Subgrid
Future enhancement for nested grid layouts:

```css
.nested-grid {
  display: grid;
  grid: subgrid / subgrid;
}
```

## Summary

The CSS Grid layout system in Scry provides:

- **Zero Content Overlap**: Architectural solution preventing layout issues
- **Perfect Performance**: CLS score of 0 with excellent mobile viewport handling  
- **Developer Experience**: Simple, predictable layout behavior
- **Mobile Optimization**: Dynamic viewport height and responsive patterns
- **Maintainable Code**: Clear separation of concerns and consistent patterns

This system forms the foundation for all application layouts and ensures consistent, high-performance user experiences across all devices and browsers.