"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

interface ReviewCompleteStateProps {
  remainingReviews: number;
  onNextReview: () => void;
}

export function ReviewCompleteState({ remainingReviews, onNextReview }: ReviewCompleteStateProps) {
  const router = useRouter();

  return (
    <article className="w-full max-w-3xl px-4 sm:px-6 lg:px-8 py-6 animate-fadeIn">
      <div className="space-y-6">
        <div className="space-y-2 pb-6 border-b">
          <h2 className="text-xl font-semibold">Review Complete!</h2>
          <p className="text-muted-foreground">
            Great job! Your review has been recorded and the next review time has been scheduled.
          </p>
        </div>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {remainingReviews > 0
              ? `You have ${remainingReviews} more questions due for review.`
              : "You're all caught up with your reviews!"
            }
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            {remainingReviews > 0 && (
              <Button
                onClick={onNextReview}
                variant="default"
              >
                Next Review
              </Button>
            )}
            <Button
              onClick={() => router.push("/")}
              variant={remainingReviews > 0 ? "outline" : "default"}
            >
              Go Home
            </Button>
          </div>
        </div>
      </div>
    </article>
  );
}