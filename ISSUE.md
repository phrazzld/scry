app failed to load. errors:
```
Error: [CONVEX Q(spacedRepetition:getNextReview)] [Request ID: aa7120b899903a1f] Server Error
Uncaught Error: Invalid or expired session
    at getAuthenticatedUserId (../../convex/lib/auth.ts:27:17)
    at async handler (../convex/spacedRepetition.ts:222:17)

  Called by client
    at OptimisticQueryResults.queryResult (http://localhost:3000/_next/static/chunks/585b3_convex_dist_esm_f4aa2f15._.js:2302:19)
    at BaseConvexClient.localQueryResult (http://localhost:3000/_next/static/chunks/585b3_convex_dist_esm_f4aa2f15._.js:3844:44)
    at Object.localQueryResult (http://localhost:3000/_next/static/chunks/585b3_convex_dist_esm_f4aa2f15._.js:5010:44)
    at QueriesObserver.getLocalResults (http://localhost:3000/_next/static/chunks/585b3_convex_dist_esm_f4aa2f15._.js:5259:31)
    at useQueriesHelper.useMemo[subscription] (http://localhost:3000/_next/static/chunks/585b3_convex_dist_esm_f4aa2f15._.js:5442:41)
    at useSubscription.useEffect.checkForUpdates (http://localhost:3000/_next/static/chunks/585b3_convex_dist_esm_f4aa2f15._.js:5358:43)
    at basicStateReducer (http://localhost:3000/_next/static/chunks/d58e6_next_dist_compiled_977de66f._.js:6378:47)
    at updateReducerImpl (http://localhost:3000/_next/static/chunks/d58e6_next_dist_compiled_977de66f._.js:6460:79)
    at updateReducer (http://localhost:3000/_next/static/chunks/d58e6_next_dist_compiled_977de66f._.js:6410:16)
    at Object.useState (http://localhost:3000/_next/static/chunks/d58e6_next_dist_compiled_977de66f._.js:15351:24)
    at exports.useState (http://localhost:3000/_next/static/chunks/d58e6_next_dist_compiled_977de66f._.js:1699:36)
    at useSubscription (http://localhost:3000/_next/static/chunks/585b3_convex_dist_esm_f4aa2f15._.js:5329:411)
    at useQueriesHelper (http://localhost:3000/_next/static/chunks/585b3_convex_dist_esm_f4aa2f15._.js:5456:275)
    at useQueries (http://localhost:3000/_next/static/chunks/585b3_convex_dist_esm_f4aa2f15._.js:5422:12)
    at useQuery (http://localhost:3000/_next/static/chunks/585b3_convex_dist_esm_f4aa2f15._.js:5153:274)
    at usePollingQuery (http://localhost:3000/_next/static/chunks/_ae1a0bae._.js:74:266)
    at ReviewFlow (http://localhost:3000/_next/static/chunks/_ae1a0bae._.js:2143:182)
    at Home (rsc://React/Server/file:///Users/phaedrus/Development/scry/.next/server/chunks/ssr/_39919512._.js?27:91:469)

...

Error: {} {} "Unhandled application error: [CONVEX Q(spacedRepetition:getNextReview)] [Request ID: aa7120b899903a1f] Server Error\nUncaught Error: Invalid or expired session\n    at getAuthenticatedUserId (../../convex/lib/auth.ts:27:17)\n    at async handler (../convex/spacedRepetition.ts:222:17)\n\n  Called by client"
    at createConsoleError (http://localhost:3000/_next/static/chunks/d58e6_next_dist_client_842e2c94._.js:882:71)
    at handleConsoleError (http://localhost:3000/_next/static/chunks/d58e6_next_dist_client_842e2c94._.js:1058:54)
    at Child.error (http://localhost:3000/_next/static/chunks/d58e6_next_dist_client_842e2c94._.js:1223:57)
    at Child.LOG (http://localhost:3000/_next/static/chunks/node_modules__pnpm_3fb6545d._.js:402:26)
    at Child.error (http://localhost:3000/_next/static/chunks/node_modules__pnpm_3fb6545d._.js:382:24)
    at Error.useEffect (http://localhost:3000/_next/static/chunks/_0103f752._.js:236:142)
    at ErrorBoundaryHandler.render (http://localhost:3000/_next/static/chunks/d58e6_next_dist_client_842e2c94._.js:1595:55)
    at ErrorBoundary (http://localhost:3000/_next/static/chunks/d58e6_next_dist_client_842e2c94._.js:1666:50)
    at OuterLayoutRouter (http://localhost:3000/_next/static/chunks/d58e6_next_dist_4ca862b9._.js:493:57)
```
