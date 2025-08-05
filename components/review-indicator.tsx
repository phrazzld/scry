"use client";

import { usePollingQuery } from "@/hooks/use-polling-query";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/contexts/auth-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Target, Loader2 } from "lucide-react";
import Link from "next/link";

export function ReviewIndicator() {
  const { sessionToken } = useAuth();
  const dueCount = usePollingQuery(
    api.spacedRepetition.getDueCount,
    sessionToken ? { sessionToken } : "skip",
    60000 // Poll every minute for dashboard
  );

  if (!sessionToken) {
    return null;
  }

  const isLoading = dueCount === undefined;
  const count = dueCount?.totalReviewable ?? 0;

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5" />
          Reviews Due
        </CardTitle>
        <CardDescription>
          Questions ready for spaced repetition review
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-center">
              <p className="text-4xl font-bold">{count}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {count === 1 ? "question" : "questions"} to review
              </p>
            </div>
            
            {count > 0 && (
              <Button asChild className="w-full">
                <Link href="/review">
                  Start Review Session
                </Link>
              </Button>
            )}
            
            {count === 0 && (
              <p className="text-sm text-center text-muted-foreground">
                Great job! You&apos;re all caught up.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}