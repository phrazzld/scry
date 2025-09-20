# Repository Guidelines

## Project Structure & Module Organization
`app/` covers Next.js routes, layouts, and API handlers. Shared UI lives in `components/`, while `contexts/` and `hooks/` own stateful logic. `convex/` groups schemas, queries, and mutations by resource; `lib/` carries utilities and test helpers; `types/` shares contracts; `public/` holds static assets; `scripts/` stores asset generators and migrations. Use the `@/` and `@/convex/*` aliases for stable imports.

## Build, Test, and Development Commands
- `pnpm dev` – start Next.js (Turbopack) and the Convex dev server.
- `pnpm build` / `pnpm start` – produce and serve the production bundle.
- `pnpm lint` – run the Next.js ESLint rules with auto-fix.
- `pnpm test`, `pnpm test:watch`, `pnpm test:coverage` – execute Vitest once, in watch mode, or with coverage.
- `pnpm assets:generate` – refresh icons and static bundles in `public/`.
- `pnpm convex:deploy` – deploy Convex functions after tests.
- `./scripts/test-e2e-local.sh [--all]` – run Playwright suites against `http://localhost:3000` (append `--all` to include production scenarios).

## Coding Style & Naming Conventions
Write strict TypeScript with functional React patterns. Use two-space indentation and double quotes; ESLint enforces this and lint-staged runs `eslint --fix` plus `pnpm tsc --noEmit` on staged files. Components and contexts use PascalCase filenames, hooks start with `use`, and Convex modules track their domain (`questions.mutations.ts`, `spacedRepetition.ts`).

## Testing Guidelines
Vitest handles unit and integration suites—colocate specs as `*.test.ts` or `*.test.tsx` near the code under test. Convex behavior follows the same naming so domain expectations stay visible. Playwright defaults to the hosted app (`playwright.config.ts`); export `PLAYWRIGHT_BASE_URL=http://localhost:3000` or use the helper script for local runs. Cover new logic with happy-path and failure cases and refresh fixtures under `tests/` when APIs shift.

## Commit & Pull Request Guidelines
History follows conventional commits (`feat:`, `fix:`, `chore:`), so match that format with concise subjects. Pull requests should link tasks, summarize key changes, and call out schema or environment updates. Attach screenshots or logs for UX or automation tweaks, confirm `pnpm lint` and `pnpm test` locally, and note any intentionally skipped suites.
- Prefer merge commits when bringing a branch up to date; avoid rebasing shared history.

## Configuration & Security Tips
Use Node 20.19+ and pnpm 10+ as declared in `package.json`. Copy `.env.example` to `.env.local`, fill secrets like `GOOGLE_AI_API_KEY`, `NEXT_PUBLIC_CONVEX_URL`, `CONVEX_DEPLOY_KEY`, and keep them out of Git. Convex dev requires a Clerk session; sign in before testing review flows. Avoid logging tokens or prompt contents in server code.
