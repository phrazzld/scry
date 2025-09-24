# TODO.md

## UI Architecture Refactor - Card Aesthetic Removal

### Completed
- [x] Remove Card component imports from QuizSessionManager (`components/quiz-session-manager.tsx:5`)
- [x] Replace Card wrapper with semantic article element for better HTML structure
- [x] Eliminate centered flexbox layout (`min-h-screen flex items-center justify-center`) in favor of left-aligned content
- [x] Flatten component hierarchy by removing CardContent/CardHeader wrappers
- [x] Apply consistent spacing using Tailwind space utilities instead of card padding

### Critical Path - Consistency Pass
- [x] Audit ReviewCompleteState component for remaining Card usage - must match QuizSessionManager's new pattern
- [x] Strip Card components from QuizCompleteState (`components/quiz-flow/quiz-complete-state.tsx`) - use same article/h2 pattern
- [x] Remove Card from ReviewReadyState and ReviewEmptyState components - maintain visual hierarchy with typography alone
- [x] Update QuizGeneratingState skeleton to match new left-aligned layout - no centered card shimmer
- [x] Verify QuizReadyState component alignment - should left-align like active quiz state

### Layout Refinement
- [~] Implement consistent max-width across all quiz flow states - currently using `max-w-3xl`, verify this doesn't break mobile
  ```
  Work Log:
  - Unified all quiz flow states to use max-w-3xl (768px / 48rem)
  - Removed redundant wrapper divs in quiz-mode and review-mode
  - QuizSessionManager already handles its own layout
  - max-w-3xl is mobile-safe: w-full ensures 100% on small screens
  - Updated: quiz-mode, review-mode, index auth message
  ```
- [x] Add responsive padding that scales: `px-4 sm:px-6 lg:px-8` for better edge spacing on larger screens
- [x] Test true/false question layout without card container - ensure 2-column grid still works visually
  ```
  Work Log:
  - Created test page at /test-layout to verify true/false questions
  - Confirmed 2-column grid layout working properly without Card components
  - Buttons display correctly in grid with proper spacing
  - Visual feedback (checkmarks/crosses) working as expected
  - No layout issues detected - grid renders cleanly
  - Screenshot captured for reference: true-false-layout-test.png
  ```
- [ ] Verify touch targets remain 44x44px minimum after card removal - critical for mobile usability
- [ ] Measure and fix any layout shift between state transitions - particularly quiz -> complete states

### Visual Polish
- [ ] Replace card shadows with subtle border-b dividers where logical separation needed
- [ ] Implement focus-visible styles on all interactive elements - lost Card's default focus handling
- [ ] Add explicit hover state to option buttons: `hover:bg-accent/50` for better affordance
- [ ] Ensure error/success states have sufficient contrast without card background - test with color blindness simulators

### Performance Optimization
- [ ] Remove unused Card component imports from bundle - check with bundle analyzer
- [ ] Verify removal of Card doesn't trigger unnecessary re-renders - use React DevTools Profiler
- [ ] Test Time to Interactive (TTI) improvement from simpler DOM structure
- [ ] Measure Cumulative Layout Shift (CLS) score - should improve without centered layout

### Testing Requirements
- [ ] Screenshot test all quiz states in both light/dark modes without cards
- [ ] Verify keyboard navigation still works through all options - Tab order must be logical
- [ ] Test with screen reader - ensure heading hierarchy makes sense without Card structure
- [ ] Load test with 50+ question quiz - ensure layout performs without card virtualization
- [ ] Cross-browser test - Safari, Firefox, Chrome, Edge for layout consistency

### Documentation Updates
- [ ] Update component documentation to reflect new structure
- [ ] Add ADR (Architecture Decision Record) explaining card removal rationale
- [ ] Update Storybook stories if they exist - remove Card wrapper examples

### Future Considerations
- [ ] Investigate replacing remaining shadcn/ui components with vanilla implementations - further simplification
- [ ] Consider CSS Grid for question layout instead of flexbox - more control, less wrapper divs
- [ ] Evaluate removing Progress component in favor of text-only indicator - "3 of 10"
- [ ] Research optimal reading line length - current `max-w-3xl` may be too wide for comfortable reading

## Technical Debt
- [ ] ReviewMode component uses `window.location.reload()` for next review - implement proper state reset instead
- [ ] QuizSessionManager has inline styles for option buttons - extract to consistent class names
- [ ] Feedback animations are missing - add subtle transitions for state changes
- [ ] No error boundary around quiz components - add graceful degradation

## Performance Metrics Baseline
- [ ] Record current Lighthouse scores before further optimizations
- [ ] Measure initial bundle size with Card components removed
- [ ] Document current FCP, LCP, TTI metrics for comparison
- [ ] Profile memory usage during long quiz sessions

## Accessibility Audit
- [ ] Ensure all interactive elements have proper ARIA labels
- [ ] Verify color contrast ratios meet WCAG AA standards
- [ ] Test with keyboard-only navigation
- [ ] Add skip links for screen reader users
- [ ] Implement proper focus management between questions

---
*Last Updated: 2025-09-23*