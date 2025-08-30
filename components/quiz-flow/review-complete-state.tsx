"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface ReviewCompleteStateProps {
  remainingReviews: number;
  onNextReview: () => void;
}

export function ReviewCompleteState({ remainingReviews, onNextReview }: ReviewCompleteStateProps) {
  const router = useRouter();

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Review Complete!</CardTitle>
        <CardDescription>
          Great job! Your review has been recorded and the next review time has been scheduled.
        </CardDescription>
      </CardHeader>
      <CardContent>
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
              onClick={() => router.push("/dashboard")}
              variant={remainingReviews > 0 ? "outline" : "default"}
            >
              View Dashboard
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}