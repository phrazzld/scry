import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpen, ArrowRight } from "lucide-react";
import Link from "next/link";
import { useState, FormEvent } from "react";
import { toast } from "sonner";

interface EmptyStateProps {
  className?: string;
}

// Deprecated - use NoCardsEmptyState instead
export function NoQuestionsEmptyState() {
  console.warn('NoQuestionsEmptyState is deprecated. Use NoCardsEmptyState instead.');
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

  const handleGenerate = async (e: FormEvent) => {
    e.preventDefault();
    if (!topic.trim() || isGenerating) return;

    setIsGenerating(true);

    try {
      const response = await fetch('/api/generate-quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: topic.trim(),
          difficulty: 'medium'
        })
      });

      if (response.ok) {
        const result = await response.json();
        const count = result.savedCount || result.questions?.length || 0;
        toast.success(`✓ ${count} questions generated!`);
        setTopic('');
        // Trigger callback to initiate review
        onGenerationSuccess?.();
      }
    } catch (error) {
      console.error('Failed to generate questions:', error);
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
          {isGenerating ? 'Generating...' : 'Generate 5 questions'}
        </button>
      </form>

      <p className="text-sm text-gray-500 mt-6">Example topics: JavaScript closures, French verbs, Linear algebra</p>
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
}

export function NothingDueEmptyState({ nextReviewTime, stats }: NothingDueEmptyStateProps) {
  const [topic, setTopic] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [showGenerate, setShowGenerate] = useState(false);

  const formatNextReviewTime = (timestamp: number | null) => {
    if (!timestamp) return null;

    const now = Date.now();
    const diff = timestamp - now;

    if (diff < 0) return "Now";

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 24) {
      const date = new Date(timestamp);
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      if (date.toDateString() === tomorrow.toDateString()) {
        return `Tomorrow, ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
      }
      return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
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
      const response = await fetch('/api/generate-quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: topic.trim(),
          difficulty: 'medium'
        })
      });

      if (response.ok) {
        toast.success("Questions generated! They'll appear shortly.");
        setTopic('');
        setShowGenerate(false);
      }
    } catch (error) {
      console.error('Failed to generate questions:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const nextReviewFormatted = formatNextReviewTime(nextReviewTime);

  return (
    <div className="max-w-xl mx-auto px-4">
      <div className="text-center mb-6">
        <h1 className="text-4xl font-bold mb-2">0 due</h1>

        {nextReviewFormatted && (
          <p className="text-lg text-gray-600">
            Next review: {nextReviewFormatted}
          </p>
        )}

        <div className="text-sm text-gray-500 mt-4">
          {stats.learningCount > 0 && `${stats.learningCount} learning`}
          {stats.learningCount > 0 && stats.totalCards > 0 && ' | '}
          {stats.totalCards > 0 && `${stats.totalCards} total`}
        </div>
      </div>

      {!showGenerate && (
        <button
          onClick={() => setShowGenerate(true)}
          className="w-full p-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
        >
          Generate more questions →
        </button>
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
              className="px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

// Keep the old component for backwards compatibility, but it's now deprecated
export function AllReviewsCompleteEmptyState() {
  console.warn('AllReviewsCompleteEmptyState is deprecated. Use NothingDueEmptyState instead.');
  return (
    <NothingDueEmptyState
      nextReviewTime={null}
      stats={{ learningCount: 0, totalCards: 0, newCount: 0 }}
    />
  );
}

export function NoQuizHistoryEmptyState({ className }: EmptyStateProps) {
  return (
    <Card className={`text-center py-8 ${className || ""}`}>
      <CardContent>
        <BookOpen className="h-10 w-10 text-gray-400 mx-auto mb-3" />
        <h3 className="text-base font-semibold mb-2">No quiz history</h3>
        <p className="text-sm text-gray-600 mb-4">
          Start taking quizzes to track your progress
        </p>
        <Button asChild size="sm">
          <Link href="/">
            Get Started
            <ArrowRight className="h-3 w-3 ml-1" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

interface ReviewsCompleteWithCountProps extends EmptyStateProps {
  remainingCount?: number;
  onNextReview?: () => void;
}

export function ReviewsCompleteWithCount({ 
  remainingCount = 0, 
  onNextReview,
  className 
}: ReviewsCompleteWithCountProps) {
  return (
    <Card className={`w-full max-w-2xl mx-auto ${className || ""}`}>
      <CardHeader>
        <CardTitle>Review Complete!</CardTitle>
        <CardDescription>
          Great job! Your review has been recorded and the next review time has been scheduled.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {remainingCount > 0
              ? `You have ${remainingCount} more question${remainingCount === 1 ? "" : "s"} due for review.`
              : "You're all caught up with your reviews!"
            }
          </p>
          {remainingCount > 0 && onNextReview && (
            <div className="flex flex-col sm:flex-row gap-2">
              <Button onClick={onNextReview} variant="default">
                Next Review
              </Button>
            </div>
          )}
        </div>
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
  className
}: CustomEmptyStateProps) {
  return (
    <Card className={`text-center py-8 ${className || ""}`}>
      <CardContent>
        <div className="mb-4">{icon}</div>
        <h3 className="text-lg font-semibold mb-2">{title}</h3>
        <p className="text-gray-600 mb-4">{description}</p>
        {(action || secondaryAction) && (
          <div className="flex flex-col sm:flex-row gap-2 justify-center">
            {action && (
              action.href ? (
                <Button asChild>
                  <Link href={action.href}>{action.label}</Link>
                </Button>
              ) : (
                <Button onClick={action.onClick}>{action.label}</Button>
              )
            )}
            {secondaryAction && (
              secondaryAction.href ? (
                <Button asChild variant="outline">
                  <Link href={secondaryAction.href}>{secondaryAction.label}</Link>
                </Button>
              ) : (
                <Button variant="outline" onClick={secondaryAction.onClick}>
                  {secondaryAction.label}
                </Button>
              )
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}