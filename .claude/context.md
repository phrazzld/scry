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

## Quick Wins Identified

- **Pattern Scout Effectiveness**: Using ast-grep to find anti-patterns before optimizing saves significant debugging time
- **Template-Based Solutions**: Once a pattern is identified, solution templates from similar code make fixes very fast
- **Systematic Logger Migration**: Find-replace console calls with structured logger - 10-minute task with major observability gains

## Convex-Specific Patterns

- **Custom Utilities for Constrained Runtime**: Convex functions can't use Node.js modules - implement lightweight custom versions
- **Production-Ready Logging Structure**: `{ timestamp, level, message, module, function, ...context }` with error serialization
- **Error Context Preservation**: Capture error.name, error.message, error.stack for structured error tracking
- **Module + Function Context Pattern**: `createLogger({ module: 'auth', function: 'sendMagicLink' })` for traceable logs

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

## Anti-patterns in Testing

- **Assuming Implementation Behavior**: Don't guess what regex does - test it. `/([.!?,]){2,}/g` behavior is counter-intuitive
- **Generic Edge Case Lists**: Focus on implementation-specific edge cases rather than theoretical ones
- **Skipping Boundary Verification**: Rate limit calculations need exact boundary testing for timestamp arithmetic accuracy