'use client';

import * as React from 'react';
import { useUser } from '@clerk/nextjs';
import { useMutation } from 'convex/react';
import { Loader2, Plus, Sparkles, X } from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { api } from '@/convex/_generated/api';
import type { Doc } from '@/convex/_generated/dataModel';
import { AUTO_FOCUS_DELAY } from '@/lib/constants/ui';
import {
  stripGeneratedQuestionMetadata,
  type GeneratedQuestionPayload,
} from '@/lib/strip-generated-questions';
import { cn } from '@/lib/utils';
import { isSuccessResponse, type GenerateQuestionsResponse } from '@/types/api-responses';

interface GenerationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentQuestion?: Doc<'questions'>;
  onGenerationSuccess?: (count: number) => void;
}

const QUICK_PROMPTS = [
  '5 easier questions',
  'Similar but harder',
  'Explain the concept',
  'Real-world applications',
];

export function GenerationModal({
  open,
  onOpenChange,
  currentQuestion,
  onGenerationSuccess,
}: GenerationModalProps) {
  const [prompt, setPrompt] = React.useState('');
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [useQuestionContext, setUseQuestionContext] = React.useState(true);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const { isSignedIn } = useUser();
  const saveQuestions = useMutation(api.questions.saveGeneratedQuestions);

  // Set smart defaults and auto-focus
  React.useEffect(() => {
    if (open) {
      setUseQuestionContext(true); // Reset to default
      // Smart default when we have context
      if (currentQuestion && !prompt) {
        setPrompt('5 more like this');
      }
      // Auto-focus after a brief delay
      setTimeout(() => {
        textareaRef.current?.focus();
        // Position cursor at end
        if (textareaRef.current) {
          const len = textareaRef.current.value.length;
          textareaRef.current.setSelectionRange(len, len);
        }
      }, AUTO_FOCUS_DELAY);
    } else {
      // Clear prompt when closing without context
      if (!currentQuestion) {
        setPrompt('');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, currentQuestion]);

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!prompt.trim()) return;

    setIsGenerating(true);

    try {
      let finalPrompt = prompt;

      // When context is enabled and available, ALWAYS include it in a structured format
      if (currentQuestion && useQuestionContext) {
        // Build a comprehensive context section with all available information
        const contextParts = [
          'CURRENT QUESTION CONTEXT:',
          `Question: "${currentQuestion.question}"`,
          currentQuestion.topic ? `Topic: ${currentQuestion.topic}` : '',
          `Type: ${currentQuestion.type || 'multiple-choice'}`,
          currentQuestion.options ? `Options: ${currentQuestion.options.join(', ')}` : '',
          currentQuestion.correctAnswer ? `Correct Answer: ${currentQuestion.correctAnswer}` : '',
          currentQuestion.difficulty ? `Difficulty: ${currentQuestion.difficulty}` : '',
          currentQuestion.explanation ? `Explanation: ${currentQuestion.explanation}` : '',
        ]
          .filter(Boolean)
          .join('\n');

        // Combine context with user request in a clear, structured way
        finalPrompt = `${contextParts}

USER REQUEST: ${prompt}

Based on the above question context, generate new educational questions that fulfill the user's request. If the request is for "similar but harder" questions, make them more challenging while staying on the same topic. For "easier" questions, simplify them while maintaining educational value.`;
      }

      const response = await fetch('/api/generate-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: finalPrompt,
          difficulty: currentQuestion?.difficulty || 'medium',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate questions');
      }

      const result: GenerateQuestionsResponse = await response.json();

      // Validate response structure
      if (!isSuccessResponse(result)) {
        throw new Error('Invalid response format from API');
      }

      const count = result.questions.length;

      // Save questions if user is authenticated
      if (isSignedIn) {
        try {
          // Convert SimpleQuestion[] to GeneratedQuestionPayload[] for compatibility
          const questionsAsPayload: GeneratedQuestionPayload[] = result.questions.map(
            (q) => ({ ...q }) as GeneratedQuestionPayload
          );
          const questionsForSave = stripGeneratedQuestionMetadata(questionsAsPayload);
          await saveQuestions({
            topic: result.topic || finalPrompt,
            difficulty: result.difficulty || currentQuestion?.difficulty || 'medium',
            questions: questionsForSave,
          });
          toast.success(`✓ ${count} questions generated`);
          onGenerationSuccess?.(count);
        } catch (saveError) {
          if (process.env.NODE_ENV === 'development') {
            console.error('Failed to save:', saveError);
          }
          toast.error('Generated but failed to save');
        }
      } else {
        toast.success(`✓ ${count} questions generated. Sign in to save.`);
      }

      setPrompt(''); // Clear on success
      onOpenChange(false);
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Generation error:', error);
      }
      toast.error('Failed to generate questions');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleQuickPrompt = (quickPrompt: string) => {
    setPrompt(quickPrompt);
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Submit with Cmd/Ctrl + Enter
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && !isGenerating) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl p-0 gap-0">
        {/* Dynamic header based on context */}
        <DialogHeader className="px-6 pt-4 pb-2">
          <DialogTitle className="text-lg">
            {currentQuestion && useQuestionContext
              ? 'Generate Related Questions'
              : 'Generate New Questions'}
          </DialogTitle>
          {currentQuestion && useQuestionContext && (
            <p className="text-sm text-muted-foreground mt-1">
              Building on your question about {currentQuestion.topic || 'this concept'}
            </p>
          )}
          {(!currentQuestion || !useQuestionContext) && (
            <p className="text-sm text-muted-foreground mt-1">Create questions about any topic</p>
          )}
        </DialogHeader>

        {/* Context control */}
        {currentQuestion && (
          <div className="px-6 pb-4">
            <div className="flex items-center gap-2">
              {useQuestionContext ? (
                <Badge
                  variant="secondary"
                  className="cursor-pointer hover:bg-secondary/80 transition-colors text-xs"
                  onClick={() => setUseQuestionContext(false)}
                >
                  📚 Using context
                  <X className="h-3 w-3 ml-2" />
                </Badge>
              ) : (
                <button
                  onClick={() => setUseQuestionContext(true)}
                  className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
                  type="button"
                >
                  <Plus className="h-3 w-3" />
                  Use current question
                </button>
              )}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="px-6 pb-6 space-y-4">
          {/* Textarea */}
          <div className="space-y-2">
            <textarea
              ref={textareaRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                currentQuestion && useQuestionContext
                  ? `Describe how to modify "${currentQuestion.question.slice(0, 50)}..."`
                  : 'What would you like to learn about? Be specific or creative...'
              }
              className={cn(
                'w-full resize-none rounded-lg border border-input bg-background px-3 py-2',
                'text-sm ring-offset-background placeholder:text-muted-foreground',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                'disabled:cursor-not-allowed disabled:opacity-50',
                'h-24'
              )}
              disabled={isGenerating}
            />
            <p className="text-xs text-muted-foreground">
              Press {navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}+Enter to generate
            </p>
          </div>

          {/* Quick prompts */}
          {currentQuestion && useQuestionContext && (
            <div className="flex flex-wrap gap-2">
              {QUICK_PROMPTS.map((quickPrompt) => (
                <button
                  key={quickPrompt}
                  type="button"
                  onClick={() => handleQuickPrompt(quickPrompt)}
                  className={cn(
                    'inline-flex items-center gap-1 px-3 py-1.5 text-xs',
                    'border border-input bg-background rounded-full',
                    'hover:bg-accent hover:text-accent-foreground',
                    'transition-colors cursor-pointer',
                    prompt === quickPrompt && 'bg-accent text-accent-foreground'
                  )}
                  disabled={isGenerating}
                >
                  <Sparkles className="h-3 w-3" />
                  {quickPrompt}
                </button>
              ))}
            </div>
          )}

          {/* Submit button */}
          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={!prompt.trim() || isGenerating}
              className="min-w-[120px]"
              data-testid="generate-quiz-button"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                'Generate'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
