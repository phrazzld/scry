import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Brain, Target, BookOpen, Plus, ArrowRight } from "lucide-react";
import Link from "next/link";

interface EmptyStateProps {
  className?: string;
}

export function NoQuestionsEmptyState({ className }: EmptyStateProps) {
  return (
    <Card className={`text-center py-12 ${className || ""}`}>
      <CardContent>
        <Brain className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-2">No questions yet</h3>
        <p className="text-gray-600 mb-4">
          Generate some quizzes to see your questions here.
        </p>
        <Button asChild>
          <Link href="/create">
            <Plus className="h-4 w-4 mr-2" />
            Create Quiz
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

export function AllReviewsCompleteEmptyState({ className }: EmptyStateProps) {
  return (
    <Card className={`w-full max-w-2xl mx-auto ${className || ""}`}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5" />
          All Caught Up!
        </CardTitle>
        <CardDescription>
          You have no questions due for review right now. Great job staying on top of your learning!
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Your next review will be available soon. In the meantime, you can:
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button asChild variant="default">
              <Link href="/create">
                <Plus className="h-4 w-4 mr-2" />
                Create New Quiz
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/dashboard">
                <BookOpen className="h-4 w-4 mr-2" />
                View Dashboard
              </Link>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
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
          <div className="flex flex-col sm:flex-row gap-2">
            {remainingCount > 0 && onNextReview && (
              <Button onClick={onNextReview} variant="default">
                Next Review
              </Button>
            )}
            <Button asChild variant={remainingCount > 0 ? "outline" : "default"}>
              <Link href="/dashboard">
                View Dashboard
              </Link>
            </Button>
          </div>
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