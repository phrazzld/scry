import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useUser } from '@clerk/nextjs';
import { useMutation } from 'convex/react';
import { ArrowRight, BookOpen } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { api } from '@/convex/_generated/api';
import { IMMINENT_REVIEW_THRESHOLD_MS } from '@/lib/constants/timing';

interface EmptyStateProps {
  className?: string;
}

// Deprecated - use NoCardsEmptyState instead
export function NoQuestionsEmptyState() {
  if (process.env.NODE_ENV === 'development') {
    console.warn('NoQuestionsEmptyState is deprecated. Use NoCardsEmptyState instead.');
  }
  return <NoCardsEmptyState />;
}

interface NoCardsEmptyStateProps {
  onGenerationSuccess?: () => void;
}

/**
 * Empty state for users with no cards at all (new users)
 * Shows inline generation interface - no "empty state" feeling
 */
export function NoCardsEmptyState({ onGenerationSuccess }: NoCardsEmptyStateProps = {}) {
  const [topic, setTopic] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const { isSignedIn } = useUser();
  const createJob = useMutation(api.generationJobs.createJob);

  const handleGenerate = async (e: FormEvent) => {
    e.preventDefault();
    if (!topic.trim() || isGenerating) return;

    setIsGenerating(true);

    try {
      if (!isSignedIn) {
        toast.error('Please sign in to generate questions');
        return;
      }

      await createJob({ prompt: topic.trim() });

      toast.success('Generation started', {
        description: 'Check Background Tasks to monitor progress',
        duration: 4000,
      });

      setTopic('');
      onGenerationSuccess?.();
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Failed to create job:', error);
      }

      const errorMessage = (error as Error).message || 'Failed to start generation';
      toast.error(errorMessage, {
        description: 'Please try again',
        duration: 5000,
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto px-4">
      <h1 className="text-2xl font-bold mb-6">What do you want to learn?</h1>
      <form onSubmit={handleGenerate} className="space-y-4">
        <input
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="Enter a topic..."
          className="w-full p-3 text-lg border rounded-lg"
          autoFocus
        />
        <button
          type="submit"
          disabled={!topic || isGenerating}
          className="w-full p-3 bg-black text-white rounded-lg disabled:opacity-50"
        >
          {isGenerating ? 'Generating...' : 'Generate questions'}
        </button>
      </form>

      <p className="text-sm text-muted-foreground mt-6">
        Example topics: JavaScript closures, French verbs, Linear algebra
      </p>
    </div>
  );
}

/**
 * Empty state for users with cards but nothing currently due
 * Shows next review time and statistics
 */
interface NothingDueEmptyStateProps {
  nextReviewTime: number | null;
  stats: {
    learningCount: number;
    totalCards: number;
    newCount: number;
  };
  onContinueLearning?: () => void;
}

export function NothingDueEmptyState({
  nextReviewTime,
  stats,
  onContinueLearning,
}: NothingDueEmptyStateProps) {
  const [topic, setTopic] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [showGenerate, setShowGenerate] = useState(false);
  const { isSignedIn } = useUser();
  const createJob = useMutation(api.generationJobs.createJob);

  const formatNextReviewTime = (timestamp: number | null) => {
    if (!timestamp) return null;

    const now = Date.now();
    const diff = timestamp - now;

    // Never return "Now" - show "< 1 minute" for imminent reviews
    if (diff <= IMMINENT_REVIEW_THRESHOLD_MS) return '< 1 minute';

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 24) {
      const date = new Date(timestamp);
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      if (date.toDateString() === tomorrow.toDateString()) {
        return `Tomorrow, ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
      }
      return date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    } else if (hours > 0) {
      return `in ${hours}h ${minutes}m`;
    } else {
      return `in ${minutes}m`;
    }
  };

  const handleGenerate = async (e: FormEvent) => {
    e.preventDefault();
    if (!topic.trim() || isGenerating) return;

    setIsGenerating(true);

    try {
      if (!isSignedIn) {
        toast.error('Please sign in to generate questions');
        return;
      }

      await createJob({ prompt: topic.trim() });

      toast.success('Generation started', {
        description: 'Check Background Tasks to monitor progress',
        duration: 4000,
      });

      setTopic('');
      setShowGenerate(false);
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Failed to create job:', error);
      }

      const errorMessage = (error as Error).message || 'Failed to start generation';
      toast.error(errorMessage, {
        description: 'Please try again',
        duration: 5000,
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const nextReviewFormatted = formatNextReviewTime(nextReviewTime);

  // Check if cards are due within 1 minute
  const isImminentReview =
    nextReviewTime !== null && nextReviewTime - Date.now() <= IMMINENT_REVIEW_THRESHOLD_MS;

  return (
    <div className="max-w-xl mx-auto px-4">
      <div className="text-center mb-6">
        <h1 className="text-4xl font-bold mb-2">0 due</h1>

        {nextReviewFormatted && (
          <p className="text-lg text-muted-foreground">Next review: {nextReviewFormatted}</p>
        )}

        <div className="text-sm text-muted-foreground mt-4">
          {stats.learningCount > 0 && `${stats.learningCount} learning`}
          {stats.learningCount > 0 && stats.totalCards > 0 && ' | '}
          {stats.totalCards > 0 && `${stats.totalCards} total`}
        </div>
      </div>

      {!showGenerate && (
        <>
          {isImminentReview && onContinueLearning ? (
            <>
              <button
                onClick={onContinueLearning}
                className="w-full p-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
              >
                Continue Learning →
              </button>
              <p className="text-sm text-muted-foreground mt-2 text-center">
                Cards in learning phase need immediate review for optimal retention
              </p>
            </>
          ) : (
            <button
              onClick={() => setShowGenerate(true)}
              className="w-full p-3 border border-input text-foreground rounded-lg hover:bg-accent"
            >
              Generate more questions →
            </button>
          )}
        </>
      )}

      {showGenerate && (
        <form onSubmit={handleGenerate} className="space-y-4">
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Enter a topic..."
            className="w-full p-3 text-lg border rounded-lg"
            autoFocus
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={!topic || isGenerating}
              className="flex-1 p-3 bg-black text-white rounded-lg disabled:opacity-50"
            >
              {isGenerating ? 'Generating...' : 'Generate'}
            </button>
            <button
              type="button"
              onClick={() => setShowGenerate(false)}
              className="px-4 py-3 border border-input text-foreground rounded-lg hover:bg-accent"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

// Deprecated components removed - use NothingDueEmptyState for seamless transitions

export function NoReviewHistoryEmptyState({ className }: EmptyStateProps) {
  return (
    <Card className={`text-center py-8 ${className || ''}`}>
      <CardContent>
        <BookOpen className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
        <h3 className="text-base font-semibold mb-2">No review history</h3>
        <p className="text-sm text-muted-foreground mb-4">Start reviewing to track your progress</p>
        <Button asChild size="sm">
          <Link href="/">
            Start Reviewing
            <ArrowRight className="h-3 w-3 ml-1" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

// Generic empty state for custom scenarios
interface CustomEmptyStateProps extends EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  secondaryAction?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
}

export function CustomEmptyState({
  icon,
  title,
  description,
  action,
  secondaryAction,
  className,
}: CustomEmptyStateProps) {
  return (
    <Card className={`text-center py-8 ${className || ''}`}>
      <CardContent>
        <div className="mb-4">{icon}</div>
        <h3 className="text-lg font-semibold mb-2">{title}</h3>
        <p className="text-muted-foreground mb-4">{description}</p>
        {(action || secondaryAction) && (
          <div className="flex flex-col sm:flex-row gap-2 justify-center">
            {action &&
              (action.href ? (
                <Button asChild>
                  <Link href={action.href}>{action.label}</Link>
                </Button>
              ) : (
                <Button onClick={action.onClick}>{action.label}</Button>
              ))}
            {secondaryAction &&
              (secondaryAction.href ? (
                <Button asChild variant="outline">
                  <Link href={secondaryAction.href}>{secondaryAction.label}</Link>
                </Button>
              ) : (
                <Button variant="outline" onClick={secondaryAction.onClick}>
                  {secondaryAction.label}
                </Button>
              ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
// Zen empty state for when all reviews are complete
interface ZenEmptyStateProps {
  nextReviewTime: number | null;
  stats?: {
    streak?: number;
    retentionRate?: number;
    speedImprovement?: number;
  };
  onGenerateNewKnowledge?: () => void;
}

export function ZenEmptyState({
  nextReviewTime,
  stats,
  onGenerateNewKnowledge,
}: ZenEmptyStateProps) {
  const formatNextReviewTime = (timestamp: number | null) => {
    if (!timestamp) return null;

    const now = Date.now();
    const diff = timestamp - now;

    // Never return "Now" - show "< 1 minute" for imminent reviews
    if (diff <= IMMINENT_REVIEW_THRESHOLD_MS) return '< 1 minute';

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 24) {
      const date = new Date(timestamp);
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      if (date.toDateString() === tomorrow.toDateString()) {
        return `Tomorrow, ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
      }
      return date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    } else if (hours > 0) {
      return `in ${hours}h ${minutes}m`;
    } else {
      return `in ${minutes}m`;
    }
  };

  const nextReviewFormatted = formatNextReviewTime(nextReviewTime);

  return (
    <div className="max-w-xl mx-auto px-4">
      <div className="text-center mb-6">
        {/* Main status */}
        <h1 className="text-3xl font-bold mb-4 text-success">✓ Mind synchronized</h1>

        {/* Next review time */}
        {nextReviewFormatted && (
          <p className="text-lg text-muted-foreground mb-4">Next review: {nextReviewFormatted}</p>
        )}

        {/* Metrics display */}
        {stats && (
          <div className="flex justify-center gap-8 mt-6 mb-6 text-sm">
            {stats.streak !== undefined && (
              <div className="text-center">
                <div className="text-2xl font-bold">🔥 {stats.streak}</div>
                <div className="text-muted-foreground">day streak</div>
              </div>
            )}
            {stats.retentionRate !== undefined && (
              <div className="text-center">
                <div className="text-2xl font-bold">{Math.round(stats.retentionRate)}%</div>
                <div className="text-muted-foreground">retention</div>
              </div>
            )}
            {stats.speedImprovement !== undefined && stats.speedImprovement > 0 && (
              <div className="text-center">
                <div className="text-2xl font-bold text-success">
                  {stats.speedImprovement > 0 ? '+' : ''}
                  {Math.round(stats.speedImprovement)}%
                </div>
                <div className="text-muted-foreground">faster recall</div>
              </div>
            )}
          </div>
        )}

        {/* Generate button */}
        <button
          onClick={onGenerateNewKnowledge}
          className="px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
        >
          Generate new knowledge →
        </button>
      </div>
    </div>
  );
}
