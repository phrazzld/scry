# Scry

An AI-powered quiz generation and learning application built with Next.js 15 and Convex. Uses Google Gemini for intelligent content generation and implements spaced repetition algorithms for optimized learning.

## Features

- **AI-Powered Quiz Generation**: Create personalized quizzes using Google Gemini
- **Question Management**: Edit, delete, and restore your questions with creator-only permissions
- **Individual Question Tracking**: Every generated question is persisted and tracked independently
- **Interaction Analytics**: Each answer attempt is recorded with timing and accuracy data
- **Optimistic UI**: Immediate feedback for all operations with automatic error rollback
- **Pure FSRS Spaced Repetition**: Unmodified FSRS algorithm without comfort features or daily limits
- **Magic Link Authentication**: Secure, passwordless authentication with Convex Auth
- **Real-time Updates**: Built on Convex for instant data synchronization
- **Responsive Design**: Modern UI with Tailwind CSS and shadcn/ui components
- **Keyboard Shortcuts**: Power user shortcuts for efficient navigation and review

## Philosophy: Hypersimplicity & Pure Memory Science

Scry respects the science of memory without compromise:

- **No Daily Limits**: If 300 cards are due, you see 300 cards
- **No Comfort Features**: The forgetting curve doesn't care about your comfort
- **Natural Consequences**: Generate 50 questions? Review 50 questions
- **Brutal Honesty**: Real counts, real progress, real learning debt
- **Pure FSRS**: The algorithm as designed, without "improvements"

Every "enhancement" that makes spaced repetition more comfortable makes it less effective. Scry chooses effectiveness.

## Prerequisites

- Node.js 20.0.0 or higher
- pnpm 10.0.0 or higher
- Convex account (free tier available)
- Google AI API key (for quiz generation)
- Resend API key for email

## Quick Start

### 1. Clone and Install

```bash
git clone <repository-url>
cd scry
pnpm install
```

### 2. Convex Setup

Scry uses Convex for the backend database and real-time features. You'll need to create a Convex account and project.

#### Create Convex Account and Project

1. **Sign up for Convex** (free tier available):
   ```bash
   # Visit https://convex.dev and create an account
   # Or sign up via CLI
   npx convex dev --new
   ```

2. **Initialize Convex in your project**:
   ```bash
   # Install Convex CLI globally (recommended)
   npm install -g convex
   
   # Initialize Convex (follow prompts to create/link project)
   npx convex dev
   ```

3. **Configure your Convex project**:
   - Follow the CLI prompts to create a new project or link an existing one
   - Choose your team/organization
   - The CLI will automatically generate your `NEXT_PUBLIC_CONVEX_URL`

#### Get Required Keys

4. **Get your Convex Deployment Key** (for production deployments):
   - Go to [Convex Dashboard](https://dashboard.convex.dev)
   - Select your project
   - Navigate to **Settings** → **URL and Deploy Key**
   - Generate and copy your **production deploy key**
   - For preview deployments, also generate a **preview deploy key**

### 3. Environment Setup

```bash
# Copy the environment template
cp .env.example .env.local

# Edit .env.local with your configuration
# Your NEXT_PUBLIC_CONVEX_URL should already be set from the Convex setup
# Add the remaining required values (see "Environment Variables" section)

# Validate your environment
pnpm env:validate
```

### 4. Development Server

```bash
# In terminal 1: Start Next.js development server
pnpm dev

# In terminal 2: Start Convex development server
npx convex dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

## Environment Variables

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `GOOGLE_AI_API_KEY` | Google AI API key for quiz generation | `AIzaSy...` |
| `NEXT_PUBLIC_CONVEX_URL` | Convex deployment URL | `https://...convex.cloud` |
| `CONVEX_DEPLOY_KEY` | Convex deploy key (for Vercel deployments) | `prod:...` |
| `RESEND_API_KEY` | Resend API key for magic link emails | `re_...` |
| `EMAIL_FROM` | From address for auth emails | `Scry <noreply@yourdomain.com>` |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NEXT_PUBLIC_APP_URL` | Application base URL for magic links | Auto-detected |

For detailed setup instructions, see [docs/environment-setup.md](docs/environment-setup.md).

## Development Commands

```bash
# Development
pnpm dev                    # Start development server
pnpm build                  # Build for production
pnpm start                  # Start production server
pnpm lint                   # Run linting

# Testing
pnpm test                   # Run unit tests
pnpm test:coverage          # Run tests with coverage
pnpm test:e2e               # Run end-to-end tests

# Environment Management
pnpm env:validate           # Validate current environment
pnpm env:validate:prod      # Validate production readiness
pnpm deploy:check           # Full deployment readiness check

# Asset Generation
pnpm assets:generate        # Generate static assets
pnpm assets:generate-all    # Generate all assets (verbose)
```

## Testing

The project uses Vitest for unit and integration testing, with Playwright for end-to-end tests.

### Running Tests

```bash
# Run all unit tests
pnpm test

# Run tests in watch mode for development
pnpm test:watch

# Run tests with coverage report
pnpm test:coverage

# Run specific test file
pnpm test lib/format-review-time.test.ts

# Run E2E tests
pnpm test:e2e
```

### Test Structure

Tests are located alongside their source files using the `.test.ts` or `.test.tsx` suffix:

```
lib/
  format-review-time.ts
  format-review-time.test.ts
components/
  Button.tsx
  Button.test.tsx
convex/
  fsrs.ts
  fsrs.test.ts
```

### Coverage Reports

After running `pnpm test:coverage`, coverage reports are available in:
- **Terminal**: Summary displayed after test run
- **HTML Report**: Open `coverage/index.html` in your browser for detailed coverage
- **JSON**: `coverage/coverage-final.json` for CI integration

Current coverage is intentionally low as we build up the test suite incrementally. Focus is on testing critical business logic first.

### Writing Tests

Example test structure:

```typescript
import { describe, it, expect } from 'vitest'
import { yourFunction } from './your-module'

describe('yourFunction', () => {
  it('should handle expected input', () => {
    const result = yourFunction('input')
    expect(result).toBe('expected output')
  })
})
```

## Deployment

⚠️ **Critical**: Backend functions MUST be deployed before frontend builds. This project uses automatic atomic deployment to prevent mismatches.

### Deployment Architecture

This project uses separate Convex instances:
- **Development**: `amicable-lobster-935` (local development)
- **Production**: `uncommon-axolotl-639` (production deployments)

**Deployment Order**: Convex Backend → Validation → Vercel Frontend

### Prerequisites

1. **Vercel CLI**: Install and authenticate
   ```bash
   npm install -g vercel
   vercel login
   ```

2. **Convex Deploy Key**: Get production deploy key
   - Visit [Convex Dashboard](https://dashboard.convex.dev)
   - Navigate to Settings → Deploy Keys
   - Generate and copy **production deploy key** (starts with `prod:`)

3. **Environment Validation**: Ensure all required variables are set
   ```bash
   pnpm env:validate:prod
   pnpm deploy:check
   ```

### Automated Deployment (Recommended)

The project uses automated atomic deployment via Vercel's build command:

#### Initial Setup

1. **Link Vercel Project** (first time only):
   ```bash
   vercel link
   ```

2. **Configure Environment Variables** in Vercel Dashboard:
   - `GOOGLE_AI_API_KEY` - Google AI API key
   - `NEXT_PUBLIC_CONVEX_URL` - Production Convex URL
   - `CONVEX_DEPLOY_KEY` - Production deploy key (from step 2) - **Production only**
   - `RESEND_API_KEY` - Resend API key for emails
   - `EMAIL_FROM` - Email sender address

   **Important:**
   - Set all variables for **both Production and Preview** environments
   - **Exception:** `CONVEX_DEPLOY_KEY` is only needed for Production
     - Preview deployments use the already-deployed development Convex instance
     - They do not trigger new Convex deployments, only Next.js builds

3. **Update Build Command** in Vercel Dashboard:
   - Navigate to: Project Settings → Build & Development Settings
   - Set "Build Command Override": `npx convex deploy --cmd 'pnpm build'`
   - This is already configured in `vercel.json` but dashboard override provides redundancy

#### Deploying

```bash
# Deploy to preview environment
vercel

# Deploy to production
vercel --prod
```

**What Happens Automatically:**
1. Vercel runs: `npx convex deploy --cmd 'pnpm build'`
2. Convex functions deploy first using `CONVEX_DEPLOY_KEY`
3. Schema version tracking validates compatibility
4. Next.js application builds with deployed backend
5. Frontend deploys to Vercel

### Manual Deployment (Production Hotfix)

For manual deployments or production hotfixes, use the atomic deployment script:

```bash
# Export production deploy key
export CONVEX_DEPLOY_KEY="prod:your-key-here"

# Run atomic deployment script
./scripts/deploy-production.sh
```

**Script Steps:**
1. Deploys Convex backend functions
2. Runs health check to verify critical functions exist
3. Deploys Vercel frontend (only if backend healthy)
4. Exits with error at first failure

### Deployment Validation

#### Health Check Script

Verify deployment health before and after deploying:

```bash
# Check that all critical functions are deployed
./scripts/check-deployment-health.sh
```

**Validates:**
- Convex deployment connectivity
- Critical functions exist:
  - `generationJobs:getRecentJobs`, `createJob`, `cancelJob`
  - `aiGeneration:processJob`
  - `questions:saveBatch`
  - `spacedRepetition:getNextReview`, `scheduleReview`

Exit codes: `0` = healthy, `1` = unhealthy with detailed error

#### Schema Version Tracking

The application automatically validates frontend/backend compatibility:

- **Backend Version**: Defined in `convex/schemaVersion.ts`
- **Frontend Version**: Defined in `lib/deployment-check.ts`
- **Validation**: Runs on every page load via `DeploymentVersionGuard`

**Backwards Compatibility:**
- If backend doesn't have version checking function, check is **silently skipped**
- Allows gradual rollout without breaking existing deployments
- Console warning logged for debugging

**On Version Mismatch:**
- Error displayed to user with clear explanation
- Instructions provided for fixing the mismatch
- Prevents runtime errors from missing functions/fields

**Feature Flag (Emergency Bypass):**
Set `NEXT_PUBLIC_DISABLE_VERSION_CHECK=true` to disable version checking entirely.
```bash
# In Vercel dashboard or .env.local
NEXT_PUBLIC_DISABLE_VERSION_CHECK=true
```

**Updating Schema Version:**
1. Increment version in `convex/schemaVersion.ts` (semantic versioning)
2. Update matching version in `lib/deployment-check.ts`
3. Deploy backend first: `npx convex deploy`
4. Deploy frontend second: `vercel --prod`
5. Or use atomic script: `./scripts/deploy-production.sh`

### Production Monitoring

After deployment, verify functionality:

```bash
# View Vercel deployment logs
vercel logs --prod
vercel logs --prod --follow  # Real-time streaming

# View Convex backend logs
npx convex logs

# Run health check
./scripts/check-deployment-health.sh
```

**Manual Verification:**
1. Visit production URL and check for "Server Error"
2. Open browser console - should be clean except preload warnings
3. Test question generation flow
4. Test spaced repetition reviews
5. Verify schema version check passes (no error modal)

### Troubleshooting Deployments

**"Function not found" errors in production:**
- **Cause**: Frontend deployed before backend functions
- **Fix**: Run `npx convex deploy` then redeploy frontend
- **Prevention**: Use automated deployment or atomic script

**Schema version mismatch errors:**
- **Cause**: Backend and frontend versions don't match
- **Fix**: Ensure both `convex/schemaVersion.ts` and `lib/deployment-check.ts` have same version
- **Deploy**: Backend first, then frontend

**Convex deploy fails in Vercel build:**
- **Cause**: `CONVEX_DEPLOY_KEY` not set or invalid
- **Fix**: Verify key exists in Vercel environment variables
- **Scope**: Must be set for both Production AND Preview

**Health check fails:**
- **Cause**: Critical functions missing from deployment
- **Fix**: Check Convex dashboard for deployment errors
- **Retry**: `npx convex deploy` to redeploy functions

### Deployment Best Practices

1. **Always Use Atomic Deployment**: Prefer automated Vercel deployment or manual script
2. **Validate Before Deploying**: Run `./scripts/check-deployment-health.sh` before production deploy
3. **Update Schema Versions**: Keep frontend and backend versions in sync
4. **Monitor After Deploy**: Check logs and run health check after every deployment
5. **Test Preview First**: Deploy to preview environment before production

## Production URLs

- **Current Production**: https://scry-o08qcl16e-moomooskycow.vercel.app
- **Health Check**: https://scry-o08qcl16e-moomooskycow.vercel.app/api/health

<!-- Deployment test: verifying atomic Convex+Vercel deployment (retry with fixed deploy key) -->

## Architecture

- **Framework**: Next.js 15 with App Router
- **Backend**: Convex for database, authentication, and real-time features
- **Database Model**: Individual question persistence with separate interactions tracking
- **AI Integration**: Google Gemini via Vercel AI SDK
- **Authentication**: Magic link email authentication with Convex Auth
- **Styling**: Tailwind CSS v4 with shadcn/ui components
- **Email**: Resend for magic link delivery

## Key Features

### AI Quiz Generation
- Generates structured quizzes with 5 questions and 4 answer options
- Questions are persisted individually upon generation (not just quiz results)
- Each answer attempt is tracked with timing and accuracy data
- Supports difficulty levels: easy, medium, hard
- Uses JSON schema validation for consistent output
- API endpoint: `/api/generate-questions`

### Authentication System
- Magic link authentication via email
- Session management with Convex Auth
- Protected routes and API endpoints
- Comprehensive error handling and logging

### Performance Monitoring
- Built-in performance monitoring dashboard
- Core Web Vitals tracking
- Database query performance monitoring
- Individual question and interaction analytics
- Custom metrics API at `/api/performance`

### Question & Interaction Tracking
- Every generated question is stored independently
- User interactions tracked with millisecond precision
- Denormalized stats for efficient querying (attemptCount, correctCount)
- Dashboard views for all questions and unattempted questions
- Historical quiz results linked to individual interactions

### Spaced Repetition Learning

Scry uses an advanced spaced repetition system powered by the FSRS (Free Spaced Repetition Scheduler) algorithm to optimize your learning and retention.

#### How It Works

1. **Automatic Scheduling**: Every question you answer is automatically scheduled for review based on your performance
2. **Smart Review Queue**: Questions appear for review at scientifically-optimized intervals to maximize retention
3. **No Manual Rating**: Unlike traditional spaced repetition apps, Scry automatically determines review intervals based on whether you answered correctly or incorrectly
4. **Real-time Updates**: Your review queue updates in real-time as questions become due

#### Accessing Reviews

- **Review Page**: Click "Review" in the navigation menu to access your review queue
- **Dashboard Indicator**: See how many questions are due for review on your dashboard
- **Quick Start**: Use the "Start Review" button on the dashboard to jump right in

#### The Automatic Advantage

Traditional spaced repetition systems require you to rate your confidence (e.g., "Again", "Hard", "Good", "Easy") after each answer. Scry simplifies this:

- **Correct Answer** → Scheduled for review at a longer interval
- **Incorrect Answer** → Scheduled for immediate or short-term review

This approach:
- **Saves Time**: No need to think about rating your confidence
- **Reduces Bias**: Removes subjective self-assessment
- **Mobile-Friendly**: Single-tap answers work perfectly on phones
- **Faster Reviews**: Complete more reviews in less time

#### The Science Behind It

Scry uses the FSRS algorithm, which represents the current state-of-the-art in spaced repetition:

- **Adaptive Intervals**: Review intervals automatically adjust based on your performance history
- **Optimal Retention**: Maintains ~90% retention rate with minimal reviews
- **Memory Modeling**: Tracks stability and difficulty for each question individually
- **Efficient Learning**: Reduces total review time by 30-50% compared to traditional methods

#### Getting Started with Reviews

1. **Create Quizzes**: Generate quizzes on topics you want to learn
2. **Answer Questions**: Complete quizzes at your own pace
3. **Check Reviews**: Visit the Review page when questions become due
4. **Stay Consistent**: Regular reviews lead to long-term retention

The review indicator on your dashboard will show when questions are ready for review. Questions you've never seen before are prioritized, followed by overdue questions that need reinforcement.

### Question Management & CRUD Operations

Scry provides comprehensive question management capabilities with creator-only permissions and optimistic UI for immediate feedback.

#### Features Overview

- **Edit Questions**: Modify question text, topic, and explanation while preserving spaced repetition data
- **Soft Delete**: Delete questions with ability to restore them later
- **Creator Permissions**: Only question creators can edit or delete their questions
- **Optimistic Updates**: Immediate UI feedback with automatic rollback on errors
- **Real-time Sync**: Changes sync instantly across all sessions using Convex
- **FSRS Preservation**: CRUD operations preserve spaced repetition scheduling data

#### Managing Your Questions

**Accessing Question Management:**
1. Navigate to "My Questions" from the dashboard or main menu
2. View all your created questions in a searchable grid
3. Use edit/delete buttons that appear only on questions you created

**Editing Questions:**
- Click the edit button (pencil icon) on any question you created
- Modify the question text, topic, or explanation
- Questions, options, and correct answers cannot be changed to preserve learning data
- Changes are saved instantly with immediate visual feedback
- Form validation ensures data integrity

**Deleting Questions:**
- Click the delete button (trash icon) with confirmation dialog
- Questions are soft-deleted (not permanently removed)
- Deleted questions are excluded from quiz generation and spaced repetition
- Your learning progress and interaction history are preserved

**Restoring Questions:**
- Use the `restoreQuestion` API to recover accidentally deleted questions
- All spaced repetition data and interaction history remain intact
- Restored questions immediately re-enter your review queue if due

#### Technical Implementation

**Permission Model:**
```typescript
// Creator-only access enforced at the database level
const isOwner = question.userId === ctx.userId;
if (!isOwner) {
  throw new Error("Only the question creator can edit this question");
}
```

**Optimistic Updates:**
- **Edit Operations**: Immediate UI updates with automatic rollback on server errors
- **Delete Operations**: Questions disappear instantly with toast confirmation
- **Error Handling**: Failed operations revert UI state and show error messages
- **Performance**: <1ms perceived response time via optimistic state management

**Data Integrity:**
- **FSRS Preservation**: Spaced repetition scheduling data (stability, difficulty, review dates) remains unchanged during edits
- **Interaction History**: All previous answer attempts and timing data are preserved
- **Soft Delete**: Deleted questions retain all data and can be fully restored
- **Audit Trail**: All CRUD operations are logged with timestamps

**API Endpoints:**
- `questions.updateQuestion`: Edit question with validation and permissions
- `questions.softDeleteQuestion`: Soft delete with creator verification  
- `questions.restoreQuestion`: Restore deleted questions with full data recovery
- `questions.getUserQuestions`: Query with optional `includeDeleted` parameter

#### Best Practices

**When to Edit:**
- Fix typos or clarify question wording
- Update topic categorization for better organization
- Add or improve explanations for learning value
- Avoid changing the meaning or correct answer

**When to Delete:**
- Remove duplicate questions
- Clean up poorly generated content
- Remove questions that are no longer relevant
- Note: Deletion doesn't affect your learning statistics

**Performance Considerations:**
- CRUD operations use optimistic updates for instant feedback
- Large question libraries may benefit from pagination (implemented automatically)
- Search and filtering help manage extensive question collections
- Real-time sync ensures consistency across devices and sessions

### Keyboard Shortcuts

Scry includes comprehensive keyboard shortcuts for power users to navigate and review efficiently.

#### Global Shortcuts (Available Everywhere)

| Shortcut | Action | Description |
|----------|--------|-------------|
| `?` | Show Help | Display keyboard shortcuts reference |
| `h` | Home | Navigate to home/review page |
| `Ctrl+S` | Settings | Open settings page |
| `n` | New Questions | Focus topic input for generation |
| `Esc` | Close/Cancel | Close modals or cancel editing |

#### Review Mode Shortcuts

| Shortcut | Action | Description |
|----------|--------|-------------|
| `1-4` | Select Answer | Choose answer option by number |
| `Enter` | Submit/Next | Submit answer or go to next question |
| `Space` | Next Question | Advance when showing feedback |
| `→` | Next Question | Alternative next navigation |
| `e` | Edit Question | Open edit mode for current question |
| `d` or `Delete` | Delete Question | Remove current question |
| `Ctrl+Z` | Undo | Undo last action (when available) |
| `s` | Skip Question | Mark as difficult and skip |
| `x` | Toggle Explanation | Show/hide answer explanation |

#### Visual Indicators

- **Keyboard Icon**: A pulsing keyboard icon appears in the bottom-right corner
- **Help Modal**: Press `?` at any time to see all available shortcuts
- **Context Awareness**: Shortcuts adapt based on current state (answering vs feedback)

#### Power User Tips

1. **Speed Review**: Use number keys for answers and Enter to submit rapidly
2. **Keyboard-Only Navigation**: Complete entire review sessions without touching the mouse
3. **Quick Edits**: Press `e` to instantly edit questions inline
4. **Efficient Skipping**: Use `s` to mark difficult questions for later review
5. **Modal Management**: Escape key consistently closes any open modal

The keyboard shortcuts system is designed to make reviewing fast and efficient, especially for users who prefer keyboard navigation over mouse interactions.

#### Development Tools Shortcuts (Dev Mode Only)

| Shortcut | Action | Description |
|----------|--------|--------------|
| `Cmd+Shift+D` (Mac) / `Ctrl+Shift+D` (PC) | Toggle Debug Panel | Shows performance metrics, render counts, and active timers |

The debug panel provides real-time performance monitoring during development:
- FPS counter and render tracking
- Component performance metrics
- Active timer monitoring
- State transition tracking

**Note**: Debug tools are automatically excluded from production builds.

## Troubleshooting

### Common Issues

**Build failures**:
- Run `pnpm env:validate` to check environment variables
- Ensure all required dependencies are installed
- Check Node.js version compatibility

**Authentication issues**:
- Verify `RESEND_API_KEY` and `EMAIL_FROM` are configured correctly
- Check magic link email delivery in your email provider
- Ensure `NEXT_PUBLIC_APP_URL` is set correctly in production
- Verify Convex auth mutations are deployed

**Convex connection issues**:
- Verify `NEXT_PUBLIC_CONVEX_URL` is correct from your Convex dashboard
- Ensure Convex development server is running: `npx convex dev`
- Check that Convex functions are deployed: `npx convex deploy`
- Verify `CONVEX_DEPLOY_KEY` is set for production deployments
- Run `npx convex logs` to check for backend errors
- Ensure you're connected to the correct Convex project

**Deployment issues**:
- Check that both Convex and Vercel deployments succeed
- Verify all environment variables are set in Vercel dashboard
- Ensure `CONVEX_DEPLOY_KEY` is configured for both Production and Preview environments
- Run the deployment verification script: `node scripts/verify-deployment-setup.cjs`

### Getting Help

1. Check the [docs/](docs/) directory for detailed guides
2. Run `pnpm deploy:check` for deployment readiness
3. Monitor logs with `vercel logs <deployment-url>`
4. Visit the health endpoint for system status

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests: `pnpm test`
5. Validate environment: `pnpm env:validate`
6. Submit a pull request

## License

MIT License - see LICENSE file for details.