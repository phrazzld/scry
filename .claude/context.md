# Scry Codebase Patterns

## Patterns

- **Efficient Pagination with hasMore via .take() + 1**: Use `limit + 1` in take(), return first `limit` items, compute `hasMore = results.length > limit`
- **Cursor-based Pagination by completedAt/_id**: Replace offset-based pagination with cursor using `by_user` index ordered by `completedAt`
- **Load More Button Pattern**: Frontend uses `loadedCount` state that increments by batch size (e.g., 30) when "Load More" clicked
- **Simple .take() Pagination**: Deployments pattern shows clean pagination with just `.take(limit)` without expensive `.collect()` calls
- **Backward-Compatible Performance Fixes**: Change backend pagination logic while keeping frontend interface identical - no breaking changes needed
- **Convex Structured Logging**: Custom logger implementation needed due to constrained runtime - no Node.js modules like pino available
- **Context-Aware Logger Factory**: `createLogger({ module, function })` pattern provides consistent context across function calls
- **Environment-Aware Log Levels**: Debug logs filtered out in production, pretty-print JSON in development, compact in production
- **Early Return for Conditional Rendering**: Use `if (!condition) return null` at component top instead of wrapping entire JSX in conditionals - cleaner and more readable
- **Authentication State Simplification**: Hiding entire UI components for unauthenticated users reduces interface complexity and cognitive load
- **AI Generation Architecture Pattern**: Convex mutation (prepare/fetch data) → Next.js API route (AI generation) → Convex mutation (save results) - keeps external API calls out of Convex runtime
- **State-Based Keyboard Navigation**: Different keyboard behaviors based on UI state (answering vs feedback) - `showingFeedback` determines Enter/Space action
- **Input Focus Detection for Keyboard Shortcuts**: Check `e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement` to prevent conflicts when typing
- **preventDefault() for System Keys**: Use `e.preventDefault()` for keys like Space and Enter to prevent default browser behavior (page scroll, form submission)
- **Comprehensive useEffect Dependencies for Keyboard Events**: Include all state variables used in handlers (`showingFeedback`, `selectedAnswer`, `isAnswering`) to prevent stale closure bugs
- **Dialog-Based Modal Pattern**: Use shadcn/ui Dialog primitive for consistent modal behavior - follow existing patterns like AuthModal for new modals
- **Custom Event Pattern for Keyboard Shortcuts**: Dispatch custom events (`new CustomEvent('openGenerateModal')`) to decouple keyboard shortcuts from component hierarchy - prevents prop drilling
- **Inline UI Over Floating Elements**: Keyboard indicators and controls work better inline within existing cards rather than floating overlays - improves discoverability
- **Progressive Modal Implementation**: Build modal with textarea input, context checkbox, and form submission - use existing form validation patterns
- **Minimal CI/CD Pipeline Pattern**: Parallel execution with `command1 & command2 & wait` for <3 minute builds - aggressive simplicity over elaborate retry logic
- **Fail-Fast CI with Timeouts**: `timeout-minutes: 5` prevents stuck jobs - CI should fail quickly and obviously rather than hang
- **Local-Only E2E Testing**: Keep flaky E2E tests out of CI - run locally with `pnpm test:e2e` for comprehensive validation without CI instability
- **Single Responsibility CI**: CI does lint + test + build + deploy only - remove secret validation, elaborate checks, retry mechanisms that add complexity
- **Pre-push Hook Minimalism**: Git hooks should only run build (`pnpm build`) - avoid running tests that slow down git workflow

## Anti-patterns Found

- **Expensive .collect() for Total Count**: getQuizHistory calls `.collect()` just to get total count, which is O(n) and will degrade with scale
- **Manual Pagination via Array.slice()**: Taking `limit + offset` items then slicing is inefficient for large offsets
- **Raw console.log in Convex Functions**: Unstructured logging makes production debugging difficult - migrate to structured logger
- **Floating Action Buttons (FAB)**: Floating UI elements create discoverability issues - inline buttons in headers are more discoverable
- **Component Prop Drilling for Global Actions**: Using props to pass keyboard shortcut handlers down component trees creates coupling - custom events are cleaner
- **Elaborate CI Retry Logic**: Complex retry mechanisms, secret validation, and elaborate checks create 1000+ line workflows that are fragile and slow
- **E2E Tests in CI**: Browser-based tests are inherently flaky in CI environments - keep them local-only for reliability
- **Testing in Pre-push Hooks**: Running tests in git hooks slows down the development workflow - build-only validation is sufficient

## Performance Optimizations

- **O(n) to O(limit) Pagination Fix**: Replace `.collect()` counting with `limit + 1` fetching pattern - 5-minute change with massive performance impact
- **Convex Query Optimization**: Always prefer `.take(limit)` over `.collect().slice()` for pagination queries
- **90% CI Workflow Reduction**: 512 lines → 50 lines by removing complexity, achieving <3 minute builds vs 8+ minutes

## Bugs & Fixes

- **getQuizHistory Performance**: Original used `.collect()` to count all results (O(n)) → Fixed with `limit + 1` pattern (O(limit))
- **Convex Runtime Limitations**: Cannot import Node.js modules like pino → Create custom logger at `convex/lib/logger.ts`
- **Test Coverage Threshold Blocking**: 60% threshold requirement but only 2.82% actual coverage - disconnect between requirements and reality

## Decisions

- **Generate Related Questions Architecture**: Specification suggested internalAction in Convex → Adapted to existing pattern of Convex mutations + Next.js API routes for AI calls - maintains separation of concerns and security boundaries
- **Map vs Set for Topic Extraction**: Specification suggested Set for uniqueness → Chose Map for frequency counting - enables better UX through frequency-based sorting
- **Thorough Cleanup vs Quick Fixes**: Hypersimplicity Overhaul Phase was comprehensive and time-intensive → Result: validation phase became trivial with zero issues found - upfront thoroughness eliminates downstream debugging
- **Custom Events vs Prop Drilling for Global Shortcuts**: Keyboard shortcuts dispatch custom events rather than passing handlers through props - eliminates coupling and scales better
- **Header Button vs Floating Action Button**: Integrated Generate button in MinimalHeader rather than floating overlay - better discoverability and follows existing UI patterns
- **Simplified CI vs Feature-Rich CI**: Chose aggressive simplification (90% reduction) over maintaining complex workflows - resulted in 3x faster builds and zero maintenance burden

## Quick Wins Identified

- **Pattern Scout Effectiveness**: Using ast-grep to find anti-patterns before optimizing saves significant debugging time
- **Template-Based Solutions**: Once a pattern is identified, solution templates from similar code make fixes very fast
- **Systematic Logger Migration**: Find-replace console calls with structured logger - 10-minute task with major observability gains
- **Specification Adaptation Over Blind Implementation**: Reading existing patterns first leads to better solutions that fit the codebase architecture
- **UI-Driven Keyboard Mapping**: When UI already shows number indicators (1-4), keyboard shortcuts become obvious and intuitive to implement
- **Following Existing Modal Patterns**: Using AuthModal as template for GenerateModal speeds development and ensures consistency
- **Component Cleanup with Import Scanning**: Removing unused components by checking imports prevents dangling references and build issues
- **CI Simplification Over Feature Addition**: Aggressive deletion of CI complexity yields better results than incremental improvements
- **Already-Implemented Check**: Many optimization todos were already completed in previous phases - verification can be faster than implementation

## Accessibility & UX Patterns

- **Visual-to-Keyboard Mapping**: UI elements with visible numbers (`{index + 1}`) create natural keyboard shortcuts (1-4 keys for option selection)
- **Progressive Keyboard Enhancement**: Start with mouse/touch UI, add keyboard as enhancement without changing visual design
- **Context-Sensitive Keyboard Behavior**: Same keys (Enter/Space) perform different actions based on application state - reduces cognitive load
- **Safe Event Handler Dependencies**: Always include all state variables used in keyboard handlers in useEffect dependencies to prevent race conditions
- **Global Keyboard Shortcuts Pattern**: Single-key shortcuts like 'G' for generate work well for frequently used actions - similar to Gmail shortcuts

## Convex-Specific Patterns

- **Custom Utilities for Constrained Runtime**: Convex functions can't use Node.js modules - implement lightweight custom versions
- **Production-Ready Logging Structure**: `{ timestamp, level, message, module, function, ...context }` with error serialization
- **Error Context Preservation**: Capture error.name, error.message, error.stack for structured error tracking
- **Module + Function Context Pattern**: `createLogger({ module: 'auth', function: 'sendMagicLink' })` for traceable logs
- **Mutation Pair Pattern for AI Generation**: `prepareX` mutation (fetch/validate data) + `saveX` mutation (persist results) - enables Next.js API route to handle AI calls while maintaining data integrity
- **Map-Based Frequency Counting**: Use `Map` for efficient counting and deduplication - superior to `Set` when you need frequency data alongside uniqueness
- **Over-Fetch for Unique Results**: Take more data than needed (e.g., 100 items for 5 unique) to ensure sufficient results after filtering/deduplication
- **Frequency-First Sorting**: Sort by usage frequency rather than pure recency for better UX - most-used topics surface first

## Serverless Logging Best Practices

- **JSON Output for Log Aggregation**: Structured JSON logs work well with log aggregators like DataDog, CloudWatch
- **Environment-Based Formatting**: Pretty-print in development, compact JSON in production
- **Automatic Error Serialization**: Handle both Error instances and unknown error types gracefully
- **Context Inheritance**: Default context merged with call-specific context for rich debugging info

## Testing Edge Cases Effectively

- **Test Implementation, Not Assumptions**: Regex `/([.!?,]){2,}/g` replaces with LAST character in sequence, not first - verify actual behavior with Node REPL
- **Quick Verification with REPL**: Use `node -e "console.log('text...'.replace(/regex/, 'replacement'))"` to instantly test regex behavior before writing tests
- **Boundary Testing ±1 Pattern**: For rate limits/boundaries, test exact limits plus/minus 1 unit (timestamp boundaries, request counts)
- **Edge Cases Reveal Implementation Details**: Testing edge cases often uncovers subtle but important behavior (script tag content removal, URL format specifics)

## Time Estimation Patterns

- **Edge Case Testing is Faster Than Expected**: Estimated 2-4 hours for comprehensive edge cases, completed in 25 minutes - factor 5-10x overestimate
- **Implementation Understanding Reduces Time**: When codebase behavior is well-understood, edge case creation becomes mechanical
- **Test-Driven Verification is Efficient**: Write failing test → verify expected behavior → fix test expectations is faster than manual exploration
- **Simple UI Changes Are Very Fast**: Hide navbar task estimated 5 minutes, completed in 2 minutes - single-line solutions often faster than expected
- **Well-Structured Code Enables Trivial Changes**: When components have good conditional patterns, adding new conditions is mechanical
- **Architecture Analysis Improves Estimates**: GenerateRelated task ~8min vs estimated 15-20min - understanding existing patterns makes adaptation faster than building from scratch
- **Quick Topic Extraction Efficiency**: Simple query optimization completed in 5 minutes vs 10 minute estimate - pattern-scout analysis speeds implementation
- **Keyboard Shortcuts Implementation Speed**: Expected 10-15 minutes, completed in ~8 minutes - existing UI number indicators made keyboard mapping obvious
- **Validation Phase Speed with Clean Architecture**: Expected 15-20 minutes for cleanup validation, completed in 3 minutes - when deletions are done properly, validation becomes trivial
- **Modal Implementation with Existing Patterns**: Complex UI component creation (unified modal) takes ~30 minutes when following existing patterns and doing progressive implementation
- **CI Optimization is Often Already Done**: Estimated 30+ minutes for CI improvements, verified in 15 minutes - previous optimization phases may have already completed the work
- **Verification Can Be Faster Than Implementation**: For optimization tasks, checking if already implemented before starting can save significant time

## Anti-patterns in Testing

- **Assuming Implementation Behavior**: Don't guess what regex does - test it. `/([.!?,]){2,}/g` behavior is counter-intuitive
- **Generic Edge Case Lists**: Focus on implementation-specific edge cases rather than theoretical ones
- **Skipping Boundary Verification**: Rate limit calculations need exact boundary testing for timestamp arithmetic accuracy

## Event Handling Best Practices

- **Clean Event Listener Management**: Always remove event listeners in useEffect cleanup to prevent memory leaks and multiple handlers
- **Target Type Checking for Keyboard Events**: Use `instanceof` checks rather than generic event filtering for precise input detection
- **Window-Level Event Handling**: Global keyboard shortcuts should use `window.addEventListener('keydown')` rather than component-level handlers
- **Race Condition Prevention**: Include processing state (`isAnswering`) in event handler conditions to prevent double-submission
- **Custom Event Decoupling**: Use `CustomEvent` with specific names ('openGenerateModal') to trigger global actions without component dependencies

## Code Cleanup & Validation Patterns

- **Validation Suite Pattern**: Standard validation sequence: `build → tsc → lint → test` - comprehensive check for codebase health
- **Parallel Validation Commands**: Multiple validation commands can run in parallel for faster feedback loops  
- **Clean Component Deletion Strategy**: Proper component removal includes checking imports, references, and updating related files - prevents dangling references
- **Architectural Separation Enables Safe Deletion**: Well-separated concerns allow major component removal without breaking core functionality
- **Test Suite Isolation**: Test suites that don't depend on UI component structure remain stable during refactoring
- **Build Tools as Validation Safety Net**: Modern build tools (Next.js, TypeScript, ESLint) provide excellent coverage for catching integration issues

## UI Component Design Patterns

- **Modal State Management**: Use React Hook Form for modal form state with proper validation and TypeScript types
- **Icon Integration**: Sparkles icon from Lucide React provides visual context for AI generation features
- **Textarea Responsive Design**: Use `resize-none` and appropriate sizing for consistent modal interfaces
- **Context Checkbox Pattern**: Optional context inclusion via checkbox for user control over AI input data
- **Form Submission Flow**: Handle form submission with proper loading states and error handling

## Progressive Enhancement Patterns

- **Keyboard Shortcuts as Enhancement**: Add global shortcuts without changing mouse/touch interaction patterns
- **Inline Indicators**: Place keyboard shortcuts indicators directly in UI where they're relevant rather than in separate help areas
- **Event-Driven Architecture**: Custom events allow adding global behaviors without refactoring existing component structure
- **Graceful Fallback**: UI works fully without keyboard shortcuts - shortcuts are pure enhancement

## CI/CD Simplification Patterns

- **Aggressive Deletion Over Incremental Improvement**: 90% reduction in workflow complexity (512 → 50 lines) achieves better results than gradual optimization
- **Parallel Job Execution**: `command1 & command2 & wait` pattern enables sub-3-minute builds by running independent checks simultaneously
- **Local Development vs CI Separation**: Keep comprehensive E2E testing local-only - CI focuses on fast feedback for core checks
- **Pre-existing Optimization Recognition**: Previous development phases may have already implemented "missing" optimizations - verify before implementing
- **Build-Only Git Hooks**: Pre-push hooks should validate build success only - avoid running tests that slow git workflow
- **Fail-Fast Philosophy**: 5-minute timeouts prevent hung jobs - CI should surface problems quickly rather than retry complex logic
- **Single Responsibility CI**: Each workflow should have one clear purpose - deploy workflows shouldn't also run tests, test workflows shouldn't validate secrets