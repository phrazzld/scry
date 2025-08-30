# Layout Rollback Plan

## Overview

A feature flag system has been implemented to allow rolling back from the new CSS Grid layout to the legacy flex-based layout if issues arise in production.

## How to Enable Rollback

### Local Development

Add to your `.env.local` file:
```bash
NEXT_PUBLIC_USE_LEGACY_LAYOUT=true
```

### Vercel Deployment

1. Go to your Vercel project settings
2. Navigate to Environment Variables
3. Add: `NEXT_PUBLIC_USE_LEGACY_LAYOUT` with value `true`
4. Redeploy the application

## What Changes

### CSS Grid Layout (Default - New)
- Uses `display: grid` with `grid-template-rows: auto 1fr auto`
- Navbar uses `sticky` positioning
- No spacer div needed
- Zero content overlap guaranteed by grid system
- Perfect CLS score (0)

### Legacy Layout (Rollback)
- Uses `display: flex` with `flex-direction: column`
- Navbar uses `fixed` positioning
- Spacer div automatically added to prevent content overlap
- Manual spacing management
- May have slight CLS on initial load

## Files Involved

- `lib/layout-mode.ts` - Feature flag utilities
- `app/layout.tsx` - Conditional layout wrapper
- `components/navbar.tsx` - Conditional positioning
- `app/globals.css` - Both layout system styles

## Testing the Rollback

1. Set the environment variable locally
2. Run `pnpm dev` and verify the layout switches
3. Check that:
   - Navbar is fixed to top (not sticky)
   - Spacer div appears below navbar
   - Footer stays at bottom of page
   - No content overlap occurs

## Rolling Forward

To disable the rollback and return to CSS Grid layout:
1. Remove the `NEXT_PUBLIC_USE_LEGACY_LAYOUT` environment variable
2. Or set it to `false`
3. Redeploy if on production

## Performance Impact

- CSS Grid layout: Better performance, zero CLS
- Legacy layout: Slight performance impact due to fixed positioning reflows
- Both layouts are production-ready and tested

## Emergency Rollback

If critical issues occur with the CSS Grid layout:
1. Set `NEXT_PUBLIC_USE_LEGACY_LAYOUT=true` in Vercel
2. Redeploy (takes ~1 minute)
3. Users will immediately see the legacy layout
4. No code changes required