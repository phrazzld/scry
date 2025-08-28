# Scry

An AI-powered quiz generation and learning application built with Next.js 15 and Convex. Uses Google Gemini for intelligent content generation and implements spaced repetition algorithms for optimized learning.

## Features

- **AI-Powered Quiz Generation**: Create personalized quizzes using Google Gemini
- **Question Management**: Edit, delete, and restore your questions with creator-only permissions
- **Individual Question Tracking**: Every generated question is persisted and tracked independently
- **Interaction Analytics**: Each answer attempt is recorded with timing and accuracy data
- **Optimistic UI**: Immediate feedback for all operations with automatic error rollback
- **Spaced Repetition Learning**: Optimized review scheduling using the ts-fsrs algorithm
- **Magic Link Authentication**: Secure, passwordless authentication with Convex Auth
- **Real-time Updates**: Built on Convex for instant data synchronization
- **Responsive Design**: Modern UI with Tailwind CSS and shadcn/ui components

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

⚠️ **Important**: This project uses separate Convex instances:
- Development: amicable-lobster-935 (local development)
- Production: uncommon-axolotl-639 (Vercel deployments)

Always deploy to production before merging schema changes!

### Prerequisites

1. **Vercel CLI**: Install and authenticate
   ```bash
   npm install -g vercel
   vercel login
   ```

2. **Environment Validation**: Ensure all required variables are set
   ```bash
   pnpm env:validate:prod
   pnpm deploy:check
   ```

### Deployment Process

1. **Deploy Convex Backend**:
   ```bash
   npx convex deploy
   ```

2. **Link Vercel Project** (first time only):
   ```bash
   vercel link
   ```

3. **Configure Environment Variables**:
   ```bash
   # Pull existing variables (if any)
   vercel env pull .env.local
   
   # Add required variables via Vercel Dashboard or CLI
   vercel env add GOOGLE_AI_API_KEY
   vercel env add NEXT_PUBLIC_CONVEX_URL
   vercel env add CONVEX_DEPLOY_KEY
   vercel env add RESEND_API_KEY
   vercel env add EMAIL_FROM
   ```
   
   **Important**: Get your `CONVEX_DEPLOY_KEY` from the Convex Dashboard → Settings → Deploy Keys

4. **Deploy**:
   ```bash
   # Deploy to preview
   vercel
   
   # Deploy to production
   vercel --prod
   ```

### Convex + Vercel Integration

This application uses a coordinated deployment strategy where Convex functions are deployed automatically as part of the Vercel build process.

#### How It Works

1. **Build Command Integration**: The `vercel.json` file configures Convex deployment as part of the build:
   ```json
   {
     "buildCommand": "npx convex deploy --cmd 'pnpm build'"
   }
   ```

2. **Automatic Deployment**: When you deploy to Vercel, it automatically:
   - Deploys your Convex functions first
   - Then builds and deploys your Next.js application
   - Ensures both backend and frontend are synchronized

#### Deployment Verification

After deployment, verify everything is working:

```bash
# Check deployment status
node scripts/verify-deployment-setup.cjs

# Monitor Convex logs
npx convex logs

# Test the deployed application
curl https://your-app.vercel.app/api/health
```

#### Troubleshooting Deployments

If deployments fail:

1. **Check Convex deployment first**:
   ```bash
   npx convex deploy --prod
   ```

2. **Verify environment variables** in Vercel dashboard
3. **Check build logs** in Vercel deployment details
4. **Review Convex logs** for backend errors: `npx convex logs`

For detailed troubleshooting, see [docs/convex-deployment-fix.md](docs/convex-deployment-fix.md).

### Production Monitoring

After deployment, monitor your application:

```bash
# View production logs
vercel logs <deployment-url>

# Follow real-time logs
vercel logs <deployment-url> --follow

# View build logs
vercel inspect --logs <deployment-url>
```

**Health Check**: Visit `/api/health` on your deployed URL to verify system health.

For comprehensive monitoring setup, see [docs/monitoring-setup.md](docs/monitoring-setup.md).

## Production URLs

- **Current Production**: https://scry-o08qcl16e-moomooskycow.vercel.app
- **Health Check**: https://scry-o08qcl16e-moomooskycow.vercel.app/api/health

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
- API endpoint: `/api/generate-quiz`

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