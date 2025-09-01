import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Target, BookOpen, ArrowRight } from "lucide-react";
import Link from "next/link";
import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";

interface EmptyStateProps {
  className?: string;
}

export function NoQuestionsEmptyState() {
  const [topic, setTopic] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const router = useRouter();
  const { sessionToken } = useAuth();
  
  // Hardcoded recent topics for now (TODO: fetch from backend)
  const recentTopics = [
    "JavaScript closures",
    "React hooks",
    "TypeScript generics",
    "Linear algebra",
    "French verbs"
  ];
  
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
          difficulty: 'medium',
          sessionToken 
        })
      });
      
      if (response.ok) {
        router.refresh(); // Reload to show new questions
      }
    } catch (error) {
      console.error('Failed to generate questions:', error);
    } finally {
      setIsGenerating(false);
    }
  };
  
  const handleQuickGenerate = async (quickTopic: string) => {
    setTopic(quickTopic);
    setIsGenerating(true);
    
    try {
      const response = await fetch('/api/generate-quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          topic: quickTopic, 
          difficulty: 'medium',
          sessionToken 
        })
      });
      
      if (response.ok) {
        router.refresh(); // Reload to show new questions
      }
    } catch (error) {
      console.error('Failed to generate questions:', error);
    } finally {
      setIsGenerating(false);
    }
  };
  
  return (
    <div className="max-w-xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-4">What do you want to learn?</h1>
      <form onSubmit={handleGenerate} className="space-y-4">
        <input
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="Quantum computing, French verbs, Linear algebra..."
          className="w-full p-3 text-lg border rounded-lg"
          autoFocus
        />
        <button 
          type="submit"
          disabled={!topic || isGenerating}
          className="w-full p-3 bg-black text-white rounded-lg disabled:opacity-50"
        >
          {isGenerating ? 'Generating...' : 'Generate 5 Questions'}
        </button>
      </form>
      
      {recentTopics.length > 0 && (
        <div className="mt-6">
          <p className="text-sm text-gray-500 mb-2">Recent topics:</p>
          <div className="flex flex-wrap gap-2">
            {recentTopics.map(topic => (
              <button
                key={topic}
                onClick={() => handleQuickGenerate(topic)}
                disabled={isGenerating}
                className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded-full text-sm disabled:opacity-50"
              >
                {topic}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
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
            Your next review will be available soon. Check back later!
          </p>
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