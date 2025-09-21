# TODO: Dark Mode Implementation

## Phase 1: Make it Work [30 minutes]
Core functionality - Ship working dark mode TODAY

### Setup Infrastructure [5 min]
- [ ] Add suppressHydrationWarning to html element
- [ ] Create theme-provider.tsx wrapper component
- [ ] Integrate ThemeProvider in root layout

### CSS Foundation [10 min]
- [ ] Add dark mode CSS variables to globals.css
- [ ] Configure Tailwind dark variant

### User Interface [10 min]
- [ ] Create theme toggle component
- [ ] Add theme toggle to navbar

### Verification [5 min]
- [ ] Test FOUC prevention (hard refresh)
- [ ] Verify cross-tab synchronization

## Success Criteria
- ✅ No flash on page load
- ✅ Theme persists across sessions
- ✅ Toggle switches between light/dark/system
- ✅ Changes sync across tabs

## NOT in this PR
- Animations/transitions
- Custom theme colors
- Per-page theme overrides
- Theme-aware images