import { UnifiedQuizFlow } from "@/components/unified-quiz-flow";

export default function ReviewPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <UnifiedQuizFlow mode="review" />
    </div>
  );
}