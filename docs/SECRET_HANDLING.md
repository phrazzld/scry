# Secret Handling Protocol

## Never Commit Secrets
- ALL secrets must be in environment variables
- Use `.env.local` locally (gitignored)
- Use Vercel env vars for production
- Use Convex env vars for backend

## If You See a Secret
1. Don't commit it
2. Move to env var immediately
3. If already committed: rotate immediately

## Our Stack's Secret Management
- Clerk: Handles all auth secrets
- Convex: `npx convex env set KEY value`
- Vercel: Dashboard → Settings → Environment Variables
- Local: `.env.local` (never commit)