"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Target } from "lucide-react";

export function ReviewEmptyState() {
  const router = useRouter();

  return (
    <article className="w-full max-w-3xl px-4 sm:px-6 lg:px-8 py-6 animate-fadeIn">
      <div className="space-y-6">
        <div className="space-y-2">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Target className="h-5 w-5" />
            All Caught Up!
          </h2>
          <p className="text-muted-foreground">
            You have no questions due for review right now. Great job staying on top of your learning!
          </p>
        </div>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Your next review will be available soon. In the meantime, you can:
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              onClick={() => {
                router.push("/");
                setTimeout(() => {
                  window.dispatchEvent(new CustomEvent('open-generation-modal'));
                }, 100);
              }}
              variant="default"
            >
              Create New Quiz
            </Button>
            <Button
              onClick={() => router.push("/")}
              variant="outline"
            >
              Go Home
            </Button>
          </div>
        </div>
      </div>
    </article>
  );
}