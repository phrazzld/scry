'use client';

import { memo, useMemo, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import {
  CalendarClock,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Clock3,
  Timer,
  XCircle,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Doc } from '@/convex/_generated/dataModel';
import { describeReviewInterval, formatNextReviewTime } from '@/lib/format-review-time';
import { cn } from '@/lib/utils';

interface QuestionHistoryProps {
  interactions: Doc<'interactions'>[];
  loading?: boolean;
}

type FsrsState = 'new' | 'learning' | 'review' | 'relearning';
type InteractionContextMetadata =
  | (NonNullable<Doc<'interactions'>['context']> & {
      scheduledDays?: number | null;
      nextReview?: number | null;
      fsrsState?: FsrsState | null;
    })
  | undefined;

const MAX_VISIBLE_HISTORY = 5;

function QuestionHistoryComponent({ interactions, loading }: QuestionHistoryProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const sortedInteractions = useMemo(
    () => (interactions ? [...interactions].sort((a, b) => b.attemptedAt - a.attemptedAt) : []),
    [interactions]
  );

  const visibleInteractions = isExpanded
    ? sortedInteractions
    : sortedInteractions.slice(0, MAX_VISIBLE_HISTORY);

  const hasHidden = sortedInteractions.length > visibleInteractions.length;
  const totalAttempts = interactions?.length ?? 0;
  const correctAttempts = interactions?.filter((i) => i.isCorrect).length ?? 0;
  const successRate = totalAttempts > 0 ? Math.round((correctAttempts / totalAttempts) * 100) : 0;

  if (loading) {
    return <QuestionHistorySkeleton />;
  }

  if (!interactions || interactions.length === 0) {
    return (
      <div>
        <p className="text-sm text-muted-foreground">No previous attempts yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-foreground">Your Attempts</p>
          <p className="text-xs text-muted-foreground">
            {totalAttempts} {totalAttempts === 1 ? 'attempt' : 'attempts'} • {successRate}% correct
          </p>
        </div>
        {sortedInteractions.length > MAX_VISIBLE_HISTORY && (
          <button
            type="button"
            onClick={() => setIsExpanded((prev) => !prev)}
            className="flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            {isExpanded ? 'Show less' : `Show all ${totalAttempts}`}
            {isExpanded ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </button>
        )}
      </div>

      <ol className="space-y-4">
        {visibleInteractions.map((interaction, index) => (
          <TimelineEntry
            key={interaction._id}
            interaction={interaction}
            isLast={index === visibleInteractions.length - 1}
          />
        ))}
      </ol>

      {hasHidden && !isExpanded && (
        <p className="text-xs text-muted-foreground">
          Showing latest {visibleInteractions.length} of {sortedInteractions.length} attempts.
        </p>
      )}
    </div>
  );
}

interface TimelineEntryProps {
  interaction: Doc<'interactions'>;
  isLast: boolean;
}

function TimelineEntry({ interaction, isLast }: TimelineEntryProps) {
  const context = getExtendedContext(interaction);
  const relativeTime = formatDistanceToNow(new Date(interaction.attemptedAt), { addSuffix: true });
  const timeSpentLabel = interaction.timeSpent
    ? `${formatTimeSpent(interaction.timeSpent)} to answer`
    : null;
  const scheduleLabel = formatScheduleDescription(context);
  const fsrsStateLabel = formatFsrsState(context?.fsrsState);

  const metadataItems = [] as Array<{ key: string; label: string; icon: React.JSX.Element }>;

  metadataItems.push({
    key: `${interaction._id}-time`,
    label: relativeTime,
    icon: <Clock3 className="h-3.5 w-3.5 text-muted-foreground/70" />,
  });

  if (timeSpentLabel) {
    metadataItems.push({
      key: `${interaction._id}-duration`,
      label: timeSpentLabel,
      icon: <Timer className="h-3.5 w-3.5 text-muted-foreground/70" />,
    });
  }

  if (scheduleLabel) {
    metadataItems.push({
      key: `${interaction._id}-schedule`,
      label: `Scheduled for ${scheduleLabel}`,
      icon: <CalendarClock className="h-3.5 w-3.5 text-muted-foreground/70" />,
    });
  }

  return (
    <li className="relative pl-8">
      {!isLast && (
        <span
          className="absolute left-[10px] top-5 h-[calc(100%-1rem)] w-px bg-border/50"
          aria-hidden="true"
        />
      )}
      <span
        className={cn(
          'absolute left-0 top-3 flex h-5 w-5 items-center justify-center rounded-full border-2 text-white',
          interaction.isCorrect
            ? 'border-emerald-500 bg-emerald-500'
            : 'border-rose-500 bg-rose-500'
        )}
        aria-hidden="true"
      >
        {interaction.isCorrect ? (
          <CheckCircle className="h-3 w-3" />
        ) : (
          <XCircle className="h-3 w-3" />
        )}
      </span>
      <div className="rounded-lg border border-border/40 bg-card/40 p-3 shadow-[0_1px_2px_rgba(15,23,42,0.08)]">
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant="outline"
            className={cn(
              'uppercase tracking-wide',
              interaction.isCorrect
                ? 'border-emerald-200 text-emerald-700 dark:border-emerald-500/60 dark:text-emerald-300'
                : 'border-rose-200 text-rose-700 dark:border-rose-500/60 dark:text-rose-300'
            )}
          >
            {interaction.isCorrect ? 'Correct' : 'Incorrect'}
          </Badge>
          {fsrsStateLabel && (
            <Badge variant="outline" className="border-border/70 text-muted-foreground">
              {fsrsStateLabel}
            </Badge>
          )}
        </div>
        <p className="mt-2 text-sm font-medium text-foreground/90 whitespace-pre-wrap break-words">
          {interaction.userAnswer}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {metadataItems.map((item) => (
            <span key={item.key} className="flex items-center gap-1">
              {item.icon}
              {item.label}
            </span>
          ))}
        </div>
      </div>
    </li>
  );
}

function QuestionHistorySkeleton() {
  return (
    <div className="space-y-3">
      <div className="h-4 w-40 rounded bg-muted animate-pulse" />
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="relative pl-8">
            <span
              className="absolute left-[10px] top-5 h-[calc(100%-1rem)] w-px bg-muted"
              aria-hidden="true"
            />
            <span
              className="absolute left-0 top-3 h-5 w-5 rounded-full bg-muted"
              aria-hidden="true"
            />
            <div className="rounded-lg border border-border/30 p-3">
              <div className="h-3 w-20 rounded bg-muted animate-pulse" />
              <div className="mt-2 h-3 w-32 rounded bg-muted animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatTimeSpent(milliseconds: number): string {
  const seconds = Math.round(milliseconds / 1000);
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
}

function getExtendedContext(interaction: Doc<'interactions'>): InteractionContextMetadata {
  if (!interaction.context) {
    return undefined;
  }
  return interaction.context as InteractionContextMetadata;
}

function formatScheduleDescription(context: InteractionContextMetadata): string | null {
  if (!context) {
    return null;
  }

  if (typeof context.scheduledDays === 'number') {
    const interval = describeReviewInterval(context.scheduledDays);
    if (typeof context.nextReview === 'number') {
      return `${interval} • ${formatNextReviewTime(context.nextReview)}`;
    }
    return interval;
  }

  if (typeof context.nextReview === 'number') {
    return formatNextReviewTime(context.nextReview);
  }

  return null;
}

function formatFsrsState(state?: FsrsState | null): string | null {
  switch (state) {
    case 'learning':
      return 'Learning mode';
    case 'review':
      return 'Review interval';
    case 'relearning':
      return 'Relearning';
    case 'new':
      return 'New concept';
    default:
      return null;
  }
}

/**
 * Custom comparison function for React.memo
 * Only re-renders if:
 * - Loading state changes
 * - Interactions array length changes
 * - Or if any interaction data has actually changed
 */
function arePropsEqual(prevProps: QuestionHistoryProps, nextProps: QuestionHistoryProps): boolean {
  if (prevProps.loading !== nextProps.loading) {
    return false;
  }

  if (prevProps.interactions === nextProps.interactions) {
    return true;
  }

  if (prevProps.interactions?.length !== nextProps.interactions?.length) {
    return false;
  }

  const prevInteractions = prevProps.interactions ?? [];
  const nextInteractions = nextProps.interactions ?? [];

  for (let i = 0; i < prevInteractions.length; i++) {
    const prev = prevInteractions[i];
    const next = nextInteractions[i];
    if (
      prev._id !== next._id ||
      prev.isCorrect !== next.isCorrect ||
      prev.userAnswer !== next.userAnswer ||
      prev.attemptedAt !== next.attemptedAt ||
      prev.timeSpent !== next.timeSpent ||
      JSON.stringify(prev.context) !== JSON.stringify(next.context)
    ) {
      return false;
    }
  }

  return true;
}

export const QuestionHistory = memo(QuestionHistoryComponent, arePropsEqual);
