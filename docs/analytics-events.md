# Analytics Events Documentation

This document defines all custom analytics events tracked in Scry. Events are sent to Vercel Analytics for user behavior insights and cost $0 (included in Vercel plan).

**Privacy Notice:** All events automatically redact PII (emails, auth tokens) via `lib/analytics.ts`. User IDs are anonymized identifiers from Clerk, not personally identifiable.

---

## Event Schema

### Quiz Generation Events

#### `Quiz Generation Started`

**Purpose:** Track when background question generation jobs begin

**Trigger:** `convex/aiGeneration.ts:processJob()` - Start of generation workflow

**Properties:**
| Property | Type | Required | Description |
|---|---|---|---|
| `jobId` | string | Yes | Unique identifier for generation job |
| `userId` | string | No | Clerk user ID (auto-added by `useTrackEvent`) |
| `questionCount` | number | No | Target number of questions to generate |
| `provider` | string | No | AI provider (`openai` or `google`) |

**Example Payload:**
```json
{
  "jobId": "k17abc123",
  "userId": "user_2abc",
  "questionCount": 10,
  "provider": "openai"
}
```

---

#### `Quiz Generation Completed`

**Purpose:** Track successful generation completion with performance metrics

**Trigger:** `convex/aiGeneration.ts:processJob()` - Successful job completion

**Properties:**
| Property | Type | Required | Description |
|---|---|---|---|
| `jobId` | string | Yes | Unique identifier for generation job |
| `userId` | string | No | Clerk user ID |
| `questionCount` | number | Yes | Actual number of questions generated |
| `provider` | string | Yes | AI provider used |
| `durationMs` | number | Yes | Total generation time in milliseconds |

**Example Payload:**
```json
{
  "jobId": "k17abc123",
  "userId": "user_2abc",
  "questionCount": 10,
  "provider": "openai",
  "durationMs": 12450
}
```

**Analysis Use Cases:**
- Track average generation time by provider
- Identify performance regressions
- Monitor success rate (Completed / Started ratio)

---

#### `Quiz Generation Failed`

**Purpose:** Track generation failures for reliability monitoring

**Trigger:** `convex/aiGeneration.ts:processJob()` - Job failure or timeout

**Properties:**
| Property | Type | Required | Description |
|---|---|---|---|
| `jobId` | string | Yes | Unique identifier for generation job |
| `userId` | string | No | Clerk user ID |
| `provider` | string | No | AI provider that failed |
| `errorType` | string | No | High-level error category (e.g., `timeout`, `api_error`) |

**Example Payload:**
```json
{
  "jobId": "k17abc123",
  "userId": "user_2abc",
  "provider": "openai",
  "errorType": "rate_limit"
}
```

**Analysis Use Cases:**
- Identify which providers are unreliable
- Monitor error rate trends
- Alert on spike in failures

---

### Review Session Events

#### `Review Session Started`

**Purpose:** Track when users begin spaced repetition review

**Trigger:** `hooks/use-review-flow.ts` - First question displayed

**Properties:**
| Property | Type | Required | Description |
|---|---|---|---|
| `sessionId` | string | Yes | UUID for this review session |
| `userId` | string | No | Clerk user ID |
| `deckId` | string | No | If reviewing specific deck/collection |

**Example Payload:**
```json
{
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "userId": "user_2abc",
  "deckId": "jk9abc123"
}
```

---

#### `Review Session Completed`

**Purpose:** Track successful completion of review sessions

**Trigger:** `hooks/use-review-flow.ts` - All due questions reviewed

**Properties:**
| Property | Type | Required | Description |
|---|---|---|---|
| `sessionId` | string | Yes | UUID for this review session |
| `userId` | string | No | Clerk user ID |
| `deckId` | string | No | If reviewing specific deck |
| `durationMs` | number | No | Total session duration in milliseconds |
| `questionCount` | number | No | Number of questions reviewed |

**Example Payload:**
```json
{
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "userId": "user_2abc",
  "questionCount": 15,
  "durationMs": 180000
}
```

**Analysis Use Cases:**
- Track average session length
- Identify drop-off points (Abandoned / Started ratio)
- Monitor daily active reviewers

---

#### `Review Session Abandoned`

**Purpose:** Track when users leave review session before completion

**Trigger:** `hooks/use-review-flow.ts` - Component unmount before queue empty

**Properties:**
| Property | Type | Required | Description |
|---|---|---|---|
| `sessionId` | string | Yes | UUID for this review session |
| `userId` | string | No | Clerk user ID |
| `deckId` | string | No | If reviewing specific deck |
| `questionIndex` | number | No | How many questions were answered before abandoning |

**Example Payload:**
```json
{
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "userId": "user_2abc",
  "questionIndex": 5
}
```

**Analysis Use Cases:**
- Identify friction points (what index do users abandon?)
- A/B test interventions to reduce abandonment

---

### Question CRUD Events

#### `Question Created`

**Purpose:** Track question creation (manual or AI-generated)

**Trigger:** `convex/questionsCrud.ts` - Create mutation success

**Properties:**
| Property | Type | Required | Description |
|---|---|---|---|
| `questionId` | string | Yes | Convex document ID |
| `userId` | string | No | Clerk user ID |
| `source` | string | No | Creation source (`manual`, `ai`, `import`) |

**Example Payload:**
```json
{
  "questionId": "jk9abc123",
  "userId": "user_2abc",
  "source": "ai"
}
```

---

#### `Question Updated`

**Purpose:** Track question edits

**Trigger:** `convex/questionsCrud.ts` - Update mutation success

**Properties:**
| Property | Type | Required | Description |
|---|---|---|---|
| `questionId` | string | Yes | Convex document ID |
| `userId` | string | No | Clerk user ID |
| `source` | string | No | Update source (`manual`, `ai_regenerate`) |

**Example Payload:**
```json
{
  "questionId": "jk9abc123",
  "userId": "user_2abc",
  "source": "manual"
}
```

---

#### `Question Deleted`

**Purpose:** Track soft deletions

**Trigger:** `convex/questionsCrud.ts` - Soft delete mutation success

**Properties:**
| Property | Type | Required | Description |
|---|---|---|---|
| `questionId` | string | Yes | Convex document ID |
| `userId` | string | No | Clerk user ID |
| `source` | string | No | Deletion source (`manual`, `bulk`) |

**Example Payload:**
```json
{
  "questionId": "jk9abc123",
  "userId": "user_2abc",
  "source": "manual"
}
```

---

#### `Question Archived`

**Purpose:** Track question archival (reversible removal from active review)

**Trigger:** `convex/questionsBulk.ts` - Archive mutation success

**Properties:**
| Property | Type | Required | Description |
|---|---|---|---|
| `questionId` | string | Yes | Convex document ID (or count for bulk) |
| `userId` | string | No | Clerk user ID |
| `source` | string | No | Archive source (`manual`, `bulk`) |

**Example Payload:**
```json
{
  "questionId": "jk9abc123",
  "userId": "user_2abc",
  "source": "bulk"
}
```

---

#### `Question Restored`

**Purpose:** Track question restoration (undoing soft delete or archive)

**Trigger:** `convex/questionsBulk.ts` - Restore mutation success

**Properties:**
| Property | Type | Required | Description |
|---|---|---|---|
| `questionId` | string | Yes | Convex document ID (or count for bulk) |
| `userId` | string | No | Clerk user ID |
| `source` | string | No | Restore source (`manual`, `bulk`) |

**Example Payload:**
```json
{
  "questionId": "jk9abc123",
  "userId": "user_2abc",
  "source": "manual"
}
```

---

## Implementation Reference

### Frontend (React Components)

```typescript
import { useTrackEvent } from '@/hooks/use-track-event';

function MyComponent() {
  const track = useTrackEvent();

  const handleAction = () => {
    // TypeScript will autocomplete event names and validate properties
    track('Quiz Generation Started', {
      jobId: 'k17abc',
      questionCount: 10,
      provider: 'openai'
    });
  };
}
```

### Backend (Convex Functions)

```typescript
import { trackEvent } from '../lib/analytics';

export const myMutation = mutation({
  handler: async (ctx, args) => {
    // ... do work

    // Track event server-side
    trackEvent('Question Created', {
      questionId: result._id,
      userId: ctx.auth.userId,
      source: 'ai'
    });

    return result;
  }
});
```

---

## TypeScript Type Safety

All events are type-safe via discriminated unions in `lib/analytics.ts`:

```typescript
export interface AnalyticsEventDefinitions {
  'Quiz Generation Started': {
    jobId: string;
    userId?: string;
    questionCount?: number;
    provider?: string;
  };
  // ... other events
}

export type AnalyticsEventName = keyof AnalyticsEventDefinitions;

export type AnalyticsEventProperties<Name extends AnalyticsEventName> =
  Partial<AnalyticsEventDefinitions[Name]> & Record<string, AnalyticsEventProperty>;
```

**Benefits:**
- IDE autocomplete for event names
- Type checking for event properties
- Compile-time errors for typos

---

## Privacy & Compliance

### Automatic PII Redaction

The `lib/analytics.ts` module automatically:
- Redacts email addresses via regex: `[EMAIL_REDACTED]`
- Filters sensitive headers (authorization, cookies, API keys)
- Sanitizes all string values recursively

### What Gets Tracked

**YES (Safe):**
- User IDs (Clerk anonymous identifiers like `user_2abc`)
- Document IDs (Convex IDs like `jk9abc123`)
- Enum values (e.g., `provider: "openai"`)
- Counts, durations, timestamps

**NO (Filtered):**
- Email addresses → `[EMAIL_REDACTED]`
- Auth tokens → filtered at header level
- Question content → not included in events
- Personal names → not included in events

### GDPR Compliance

- User IDs are pseudonymous (Clerk handles PII separately)
- Users can request data deletion via Clerk
- Vercel Analytics retention: 13 months (configurable)
- No cross-site tracking or third-party cookies

---

## Dashboard Access

**Vercel Analytics:**
- URL: https://vercel.com/[your-team]/scry/analytics
- Shows custom events + Web Vitals
- Retention: 13 months

**Sentry (Error Tracking):**
- URL: https://sentry.io/organizations/[your-org]/projects/scry/
- Shows errors, not analytics events
- Retention: 90 days (free tier)

---

## Adding New Events

1. **Define event in `lib/analytics.ts`:**
   ```typescript
   export interface AnalyticsEventDefinitions {
     // ... existing events
     'My New Event': {
       eventId: string;
       userId?: string;
       customProp?: number;
     };
   }
   ```

2. **Track event in code:**
   ```typescript
   trackEvent('My New Event', {
     eventId: '123',
     customProp: 42
   });
   ```

3. **Document event in this file:**
   - Add section with purpose, trigger, properties, example
   - Update TypeScript reference if needed

4. **Test in preview deployment:**
   - Deploy to Vercel preview
   - Trigger event in browser
   - Check Vercel Analytics dashboard (5-10 min delay)

---

## Troubleshooting

**Events not appearing in Vercel Analytics:**
- Check environment: Only production/preview environments send events (not dev)
- Verify `NEXT_PUBLIC_DISABLE_ANALYTICS !== 'true'`
- Wait 5-10 minutes for events to appear in dashboard
- Check browser console for analytics errors

**Missing properties in events:**
- Ensure property names match `AnalyticsEventDefinitions` exactly
- Check that values are string | number | boolean (objects get stringified)
- Verify `undefined` values are handled (they're filtered out)

**TypeScript errors:**
- Run `pnpm tsc --noEmit` to check types
- Ensure event name is in `AnalyticsEventDefinitions`
- Check property types match interface definition

**PII leaking into events:**
- Check `lib/analytics.ts` sanitization logic
- Add new patterns to `EMAIL_REDACTION_PATTERN` if needed
- Test with production-like data in preview deployment
