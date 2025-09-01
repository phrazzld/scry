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

## Anti-patterns Found

- **Expensive .collect() for Total Count**: getQuizHistory calls `.collect()` just to get total count, which is O(n) and will degrade with scale
- **Manual Pagination via Array.slice()**: Taking `limit + offset` items then slicing is inefficient for large offsets
- **Raw console.log in Convex Functions**: Unstructured logging makes production debugging difficult - migrate to structured logger

## Performance Optimizations

- **O(n) to O(limit) Pagination Fix**: Replace `.collect()` counting with `limit + 1` fetching pattern - 5-minute change with massive performance impact
- **Convex Query Optimization**: Always prefer `.take(limit)` over `.collect().slice()` for pagination queries

## Bugs & Fixes

- **getQuizHistory Performance**: Original used `.collect()` to count all results (O(n)) → Fixed with `limit + 1` pattern (O(limit))
- **Convex Runtime Limitations**: Cannot import Node.js modules like pino → Create custom logger at `convex/lib/logger.ts`

## Decisions

- **Generate Related Questions Architecture**: Specification suggested internalAction in Convex → Adapted to existing pattern of Convex mutations + Next.js API routes for AI calls - maintains separation of concerns and security boundaries
- **Map vs Set for Topic Extraction**: Specification suggested Set for uniqueness → Chose Map for frequency counting - enables better UX through frequency-based sorting
- **Thorough Cleanup vs Quick Fixes**: Hypersimplicity Overhaul Phase was comprehensive and time-intensive → Result: validation phase became trivial with zero issues found - upfront thoroughness eliminates downstream debugging

## Quick Wins Identified

- **Pattern Scout Effectiveness**: Using ast-grep to find anti-patterns before optimizing saves significant debugging time
- **Template-Based Solutions**: Once a pattern is identified, solution templates from similar code make fixes very fast
- **Systematic Logger Migration**: Find-replace console calls with structured logger - 10-minute task with major observability gains
- **Specification Adaptation Over Blind Implementation**: Reading existing patterns first leads to better solutions that fit the codebase architecture
- **UI-Driven Keyboard Mapping**: When UI already shows number indicators (1-4), keyboard shortcuts become obvious and intuitive to implement

## Accessibility & UX Patterns

- **Visual-to-Keyboard Mapping**: UI elements with visible numbers (`{index + 1}`) create natural keyboard shortcuts (1-4 keys for option selection)
- **Progressive Keyboard Enhancement**: Start with mouse/touch UI, add keyboard as enhancement without changing visual design
- **Context-Sensitive Keyboard Behavior**: Same keys (Enter/Space) perform different actions based on application state - reduces cognitive load
- **Safe Event Handler Dependencies**: Always include all state variables used in keyboard handlers in useEffect dependencies to prevent race conditions

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

## Anti-patterns in Testing

- **Assuming Implementation Behavior**: Don't guess what regex does - test it. `/([.!?,]){2,}/g` behavior is counter-intuitive
- **Generic Edge Case Lists**: Focus on implementation-specific edge cases rather than theoretical ones
- **Skipping Boundary Verification**: Rate limit calculations need exact boundary testing for timestamp arithmetic accuracy

## Event Handling Best Practices

- **Clean Event Listener Management**: Always remove event listeners in useEffect cleanup to prevent memory leaks and multiple handlers
- **Target Type Checking for Keyboard Events**: Use `instanceof` checks rather than generic event filtering for precise input detection
- **Window-Level Event Handling**: Global keyboard shortcuts should use `window.addEventListener('keydown')` rather than component-level handlers
- **Race Condition Prevention**: Include processing state (`isAnswering`) in event handler conditions to prevent double-submission

## Code Cleanup & Validation Patterns

- **Validation Suite Pattern**: Standard validation sequence: `build → tsc → lint → test` - comprehensive check for codebase health
- **Parallel Validation Commands**: Multiple validation commands can run in parallel for faster feedback loops  
- **Clean Component Deletion Strategy**: Proper component removal includes checking imports, references, and updating related files - prevents dangling references
- **Architectural Separation Enables Safe Deletion**: Well-separated concerns allow major component removal without breaking core functionality
- **Test Suite Isolation**: Test suites that don't depend on UI component structure remain stable during refactoring
- **Build Tools as Validation Safety Net**: Modern build tools (Next.js, TypeScript, ESLint) provide excellent coverage for catching integration issues