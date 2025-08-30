"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Target } from "lucide-react";

export function ReviewEmptyState() {
  const router = useRouter();

  return (
    <Card className="w-full max-w-2xl mx-auto">
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
            <Button 
              onClick={() => router.push("/create")}
              variant="default"
            >
              Create New Quiz
            </Button>
            <Button 
              onClick={() => router.push("/dashboard")}
              variant="outline"
            >
              View Dashboard
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}