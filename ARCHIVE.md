# Route Structure Archive - Pre-Hypersimplicity Overhaul

Created: 2025-08-30  
Purpose: Document existing route structure before major simplification

## Application Routes

### Public Pages
- `/` (app/page.tsx) - Landing page with hero, features, auth modal
- `/auth/signin` (app/auth/signin/page.tsx) - Sign in page with magic link form
- `/auth/verify` (app/auth/verify/page.tsx) - Magic link verification handler

### Protected Pages (Require Authentication)
- `/dashboard` (app/dashboard/page.tsx) - Main dashboard with stats, quick actions, recent activity
- `/create` (app/create/page.tsx) - Quiz creation form with topic/difficulty selection
- `/review` (app/review/page.tsx) - Spaced repetition review interface
- `/quizzes` (app/quizzes/page.tsx) - Quiz history gallery view
- `/questions` (app/questions/page.tsx) - Question management grid (browse, edit, delete)
- `/settings` (app/settings/page.tsx) - User profile and preferences
- `/deployments` (app/deployments/page.tsx) - Deployment information (unclear purpose)

### API Routes
- `/api/auth/send-magic-link` - Send magic link email for authentication
- `/api/generate-quiz` - Generate quiz questions using AI
- `/api/quiz/complete` - Save quiz completion results
- `/api/health` - Health check endpoint
- `/api/health/preview` - Preview environment health check

### Layout & Error Handling
- `app/layout.tsx` - Root layout with navbar, providers
- `app/error.tsx` - Error boundary component
- `app/loading.tsx` - Global loading state
- `app/not-found.tsx` - 404 page
- `app/quizzes/loading.tsx` - Quiz page specific loading

## Component Usage by Route

### Dashboard Page Uses:
- QuizHistoryRealtime
- QuizStatsRealtime  
- ReviewIndicator
- Various Card components for quick actions

### Create Page Uses:
- Form components
- Topic/difficulty selectors
- Generate quiz mutation

### Review Page Uses:
- ReviewFlow component (main review logic)

### Quizzes Page Uses:
- QuizHistoryRealtime
- QuizHistory components
- Pagination

### Questions Page Uses:
- QuizQuestionsGrid
- Question CRUD operations
- Search/filter functionality

### Settings Page Uses:
- SettingsClient
- ProfileForm
- User preference controls

## Components to be Deleted

### Dashboard-specific:
- components/shared/quiz-history-realtime.tsx
- components/shared/quiz-stats-realtime.tsx
- components/review-indicator.tsx
- components/learning-progress.tsx (if exists)
- components/deployment-instructions.tsx (if exists)

### Gallery/Management:
- components/quiz-history.tsx
- components/quiz-questions-grid.tsx
- components/profile-form.tsx

## Middleware Protected Routes
From middleware.ts matcher:
- /create
- /dashboard  
- /quizzes
- /quizzes/:path*
- /settings
- /settings/:path*
- /profile
- /profile/:path*

## Total File Count Before Overhaul
- App directory routes: 20 files
- Components: 57 files
- Total: 77 files

## Database Tables in Use
- users - User accounts
- sessions - Authentication sessions
- questions - Quiz questions with FSRS fields
- interactions - Answer attempts tracking
- quizzes - Quiz containers (TO BE REMOVED)
- quizResults - Quiz completion records (TO BE REMOVED)
- magicLinks - Auth tokens
- rateLimits - Rate limiting

---

This archive serves as a reference for the pre-simplification structure.
After the overhaul, the app will have only 3 routes: /, /settings, /auth/verify