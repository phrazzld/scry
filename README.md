# Scry

An AI-powered quiz generation and learning application built with Next.js 15 and Convex. Uses Google Gemini for intelligent content generation and implements spaced repetition algorithms for optimized learning.

## Features

- **AI-Powered Quiz Generation**: Create personalized quizzes using Google Gemini
- **Individual Question Tracking**: Every generated question is persisted and tracked independently
- **Interaction Analytics**: Each answer attempt is recorded with timing and accuracy data
- **Spaced Repetition Learning**: Optimized review scheduling using the ts-fsrs algorithm
- **Magic Link Authentication**: Secure, passwordless authentication with Convex Auth
- **Real-time Updates**: Built on Convex for instant data synchronization
- **Responsive Design**: Modern UI with Tailwind CSS and shadcn/ui components

## Prerequisites

- Node.js 18.0.0 or higher
- pnpm 10.0.0 or higher
- Convex account (free tier available)
- Google AI API key
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

## Deployment

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