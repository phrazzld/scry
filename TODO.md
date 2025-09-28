# TODO - PR #23 Critical Fix

## 🔴 Merge-blocking Issue (Fix Immediately)

### [CODE FIX] Add missing args parameter to Convex polling queries
**Source**: Vercel bot review comment
**Impact**: Breaks entire polling mechanism
**Files**: `convex/spacedRepetition.ts`

Fix the following three query handlers to accept the `args` parameter:

1. **Line 216** - `getNextReview`
   ```typescript
   // Current (broken):
   handler: async (ctx) => {

   // Should be:
   handler: async (ctx, args) => {
   ```

2. **Line 294** - `getDueCount`
   ```typescript
   // Current (broken):
   handler: async (ctx) => {

   // Should be:
   handler: async (ctx, args) => {
   ```

3. **Line 352** - `getUserCardStats`
   ```typescript
   // Current (broken):
   handler: async (ctx) => {

   // Should be:
   handler: async (ctx, args) => {
   ```

**Verification Steps**:
1. Make the changes
2. Run `pnpm test` to ensure tests pass
3. Run `pnpm build` to verify build succeeds
4. Test locally that polling still works
5. Push and verify CI passes

**Note**: The `args` parameter is required by Convex when args schema is defined, even if we don't use it in the handler. This allows the `_refreshTimestamp` to be received and trigger re-evaluation.