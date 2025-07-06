implement user authentication.

users should be able to easily sign up and log in.

---

# Brainstorming & Analysis

## Research Findings

### Best Practices Research
- **Session-based authentication** recommended for Next.js 15 web apps (more secure than JWT for web)
- **OAuth integration** is now standard - support multiple providers (Google, GitHub, etc.)
- **Passwordless authentication** increasingly popular (magic links, WebAuthn/Passkeys)
- **Server-side security** critical - validate on server, use httpOnly cookies, implement rate limiting
- **Progressive disclosure** for signup - don't ask for all info upfront
- **Edge-compatible authentication** for global performance with JWT verification at edge

### Codebase Analysis
- **No existing auth implementation** - completely greenfield
- Current tech stack perfectly suited for auth: Next.js 15.3.4, React 19, TypeScript
- **Form patterns established**: React Hook Form + Zod validation (see topic-input.tsx)
- **API route patterns**: Standard Next.js handlers with proper error handling
- **Database configured but not implemented**: PostgreSQL + Vercel KV ready to use
- **Component architecture**: Server components by default, shadcn/ui patterns
- **Leyline philosophy alignment**: Simplicity, explicit behavior, no magic

## Architecture & Design Options

### Option 1: NextAuth.js (Auth.js) with Magic Links
**Approach**: Use the de-facto standard Next.js auth library with email magic links for passwordless auth
**Pros**:
- Native Next.js integration
- Minimal setup for MVP
- Progressive enhancement (can add OAuth later)
- Built-in security best practices
- Large community support
**Cons**:
- Some "magic" behavior conflicts with Leyline philosophy
- Configuration can be complex for advanced cases
**Implementation effort**: Low (5-7 hours for MVP)

### Option 2: Lucia Auth with Session-Based Authentication
**Approach**: Lightweight, explicit auth library with full control over implementation
**Pros**:
- Perfectly aligns with Leyline philosophy (simple, explicit, no magic)
- Type-safe with excellent TypeScript support
- Direct PostgreSQL integration
- Full control over auth flow
- Can use Vercel KV for session storage
**Cons**:
- More manual implementation required
- Smaller community
- Need to implement OAuth providers manually
**Implementation effort**: Medium (4-5 days)

### Option 3: Clerk Managed Authentication
**Approach**: Fully managed auth service with pre-built UI components
**Pros**:
- Fastest implementation (2-3 hours)
- Beautiful pre-built components
- Handles all edge cases
- Enterprise features included
**Cons**:
- Vendor lock-in
- Less control (conflicts with explicit behavior principle)
- Costs at scale ($25/month after 10k MAU)
- External service dependency
**Implementation effort**: Low (1-2 days)

## UI/UX Considerations
- **Entry points**: Subtle navbar "Sign in" button, post-quiz prompts to save progress
- **Modal dialog approach**: Tabbed interface for Sign in/Sign up in same dialog
- **Social login first**: Prioritize OAuth buttons above email signin
- **Progressive signup**: Only ask for email initially, gather profile data later
- **Mobile-first design**: Full-screen modals on mobile, proper touch targets
- **Accessibility**: Full keyboard navigation, ARIA labels, focus management
- **Error handling**: Inline validation, clear error messages, no technical jargon

## Technology Recommendations

### Frontend
- **Recommended**: Existing React Hook Form + Zod for auth forms
- **UI Components**: Extend current shadcn/ui patterns
- **State Management**: React Context for auth state with localStorage cache

### Backend
- **Pattern**: Server-side session management with httpOnly cookies
- **Framework**: NextAuth.js for MVP, consider Lucia for more control
- **Session Storage**: Vercel KV (Redis) for fast session lookups
- **User Data**: PostgreSQL with proper indexes

### Data Layer
- **Database**: PostgreSQL (already configured)
- **Session Cache**: Vercel KV with 30-minute TTL
- **Schema**: Minimal users table (id, email, created_at) expandable later

### External Services
- **OAuth Providers**: Google + GitHub via NextAuth providers
- **Email Service**: Resend or AWS SES for magic links
- **Rate Limiting**: Vercel KV for distributed rate limiting

## Implementation Strategy

### Recommended Approach
Start with **NextAuth.js + Magic Links** for fastest MVP, with clear migration path to add OAuth and traditional passwords later. This balances development speed with flexibility.

### MVP Path
1. **Phase 1 (Day 1)**: Basic email magic link auth with NextAuth.js
   - Install dependencies
   - Configure NextAuth with email provider
   - Create login UI reusing existing form patterns
   - Add middleware for route protection

2. **Phase 2 (Day 2)**: User association with quizzes
   - Update quiz generation to store user_id
   - Create "My Quizzes" page
   - Add user menu to navbar
   
3. **Phase 3 (Week 2)**: OAuth & Polish
   - Add Google/GitHub providers
   - Implement proper loading states
   - Add account settings page
   - Email preferences

### Risk Mitigation
- **Email deliverability**: Use established service (Resend/SES) with proper DNS setup
- **Session security**: Use secure, httpOnly, sameSite cookies with CSRF tokens
- **Database migrations**: Start with minimal schema, use migrations for changes
- **Vendor lock-in**: Choose NextAuth for easy self-hosting if needed

## Performance & Scalability Notes
- **Expected load**: Low initially, design for 10k MAU
- **Session validation**: Cache in Vercel KV to avoid DB hits (<10ms latency)
- **Database indexes**: Index on email, user_id for all user queries
- **Edge compatibility**: NextAuth works at edge with JWT strategy
- **Connection pooling**: Use dedicated auth connection pool

## Security Considerations
- **Authentication**: Magic links for passwordless, OAuth for convenience
- **Session Management**: 30-min idle timeout, 24-hour absolute timeout
- **Rate Limiting**: 5 login attempts per 15 minutes per IP
- **Data Protection**: Bcrypt/Argon2 for any future passwords
- **CSRF Protection**: Built into NextAuth with sameSite cookies
- **Account Enumeration**: Generic error messages, consistent timing
