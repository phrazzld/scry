# Scry

An AI-powered quiz generation and learning application built with Next.js 15. Uses Google Gemini for intelligent content generation and implements spaced repetition algorithms for optimized learning.

## Features

- **AI-Powered Quiz Generation**: Create personalized quizzes using Google Gemini 2.5 Flash
- **Spaced Repetition Learning**: Optimized review scheduling using the ts-fsrs algorithm
- **Magic Link Authentication**: Secure, passwordless authentication with NextAuth
- **Performance Monitoring**: Built-in monitoring and analytics dashboard
- **Responsive Design**: Modern UI with Tailwind CSS and shadcn/ui components

## Prerequisites

- Node.js 18.0.0 or higher
- pnpm 10.0.0 or higher
- PostgreSQL database
- Google AI API key
- Resend API key for email

## Quick Start

### 1. Clone and Install

```bash
git clone <repository-url>
cd scry
pnpm install
```

### 2. Environment Setup

```bash
# Copy the environment template
cp .env.example .env.local

# Edit .env.local with your configuration
# See "Environment Variables" section below for required values

# Validate your environment
pnpm env:validate
```

### 3. Development Server

```bash
# Start development server with Turbopack
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

## Environment Variables

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `GOOGLE_AI_API_KEY` | Google AI API key for quiz generation | `AIzaSy...` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host/db` |
| `NEXTAUTH_SECRET` | NextAuth.js JWT signing secret | Generate with `openssl rand -base64 32` |
| `RESEND_API_KEY` | Resend API key for emails | `re_...` |
| `EMAIL_FROM` | From address for auth emails | `Scry <noreply@yourdomain.com>` |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NEXTAUTH_URL` | Application base URL | Auto-detected (required in production) |
| `KV_URL` | Redis/KV connection for rate limiting | None |
| `KV_REST_API_URL` | KV REST API endpoint | None |
| `KV_REST_API_TOKEN` | KV API authentication token | None |

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

1. **Link Project** (first time only):
   ```bash
   vercel link
   ```

2. **Configure Environment Variables**:
   ```bash
   # Pull existing variables (if any)
   vercel env pull .env.local
   
   # Add required variables via Vercel Dashboard or CLI
   vercel env add GOOGLE_AI_API_KEY
   vercel env add DATABASE_URL
   vercel env add NEXTAUTH_SECRET
   vercel env add RESEND_API_KEY
   vercel env add EMAIL_FROM
   ```

3. **Deploy**:
   ```bash
   # Deploy to preview
   vercel
   
   # Deploy to production
   vercel --prod
   ```

### Vercel KV Setup (Optional)

For rate limiting features:

1. Visit [Vercel Dashboard](https://vercel.com/dashboard) → Storage → KV
2. Create a new KV store named "scry-kv"
3. Pull environment variables: `vercel env pull .env.local`
4. The KV variables will be automatically added to your environment

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
- **Database**: PostgreSQL with Prisma ORM
- **AI Integration**: Google Gemini 2.5 Flash via Vercel AI SDK
- **Authentication**: NextAuth with magic link email authentication
- **Styling**: Tailwind CSS v4 with shadcn/ui components
- **Caching**: Optional Vercel KV for rate limiting and session storage

## Key Features

### AI Quiz Generation
- Generates structured quizzes with 5 questions and 4 answer options
- Supports difficulty levels: easy, medium, hard
- Uses JSON schema validation for consistent output
- API endpoint: `/api/generate-quiz`

### Authentication System
- Magic link authentication via email
- Session management with NextAuth
- Protected routes and API endpoints
- Comprehensive error handling and logging

### Performance Monitoring
- Built-in performance monitoring dashboard
- Core Web Vitals tracking
- Database query performance monitoring
- Custom metrics API at `/api/performance`

## Troubleshooting

### Common Issues

**Build failures**:
- Run `pnpm env:validate` to check environment variables
- Ensure all required dependencies are installed
- Check Node.js version compatibility

**Authentication issues**:
- Verify `NEXTAUTH_SECRET` is set and unique
- Check email configuration (RESEND_API_KEY, EMAIL_FROM)
- Ensure `NEXTAUTH_URL` is set correctly in production

**Database connection**:
- Verify `DATABASE_URL` format and connectivity
- Check database permissions and network access
- Run `pnpm prisma generate` if models have changed

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