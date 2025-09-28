'use client';

import * as React from 'react';
import { useUser } from '@clerk/nextjs';
import { useMutation } from 'convex/react';
import { Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { api } from '@/convex/_generated/api';
import type { Doc } from '@/convex/_generated/dataModel';
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
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const { isSignedIn } = useUser();
  const saveQuestions = useMutation(api.questions.saveGeneratedQuestions);

  // Set smart defaults and auto-focus
  React.useEffect(() => {
    if (open) {
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
      }, 50);
    } else {
      // Clear prompt when closing without context
      if (!currentQuestion) {
        setPrompt('');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, currentQuestion]);

  // Auto-resize textarea
  React.useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      // Reset height to auto to get the correct scrollHeight
      textarea.style.height = 'auto';
      // Set height based on content, with min and max
      const newHeight = Math.min(Math.max(textarea.scrollHeight, 80), 200);
      textarea.style.height = `${newHeight}px`;
    }
  }, [prompt]);

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!prompt.trim()) return;

    setIsGenerating(true);

    try {
      // Auto-prepend context if available and not already referenced
      let finalPrompt = prompt;
      if (currentQuestion) {
        const lowerPrompt = prompt.toLowerCase();
        if (
          !lowerPrompt.includes('like this') &&
          !lowerPrompt.includes('similar') &&
          !lowerPrompt.includes('these')
        ) {
          finalPrompt = `Based on: "${currentQuestion.question}" (${currentQuestion.topic}). ${prompt}`;
        } else if (lowerPrompt === '5 more like this' || lowerPrompt === 'more like this') {
          // For simple prompts, provide more context
          finalPrompt = `Generate 5 more questions similar to: "${currentQuestion.question}" - Topic: ${currentQuestion.topic}, Difficulty: ${currentQuestion.difficulty}`;
        }
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
        {/* Compact header */}
        <DialogHeader className="px-6 pt-4 pb-4">
          <DialogTitle className="text-lg">Generate Questions</DialogTitle>
        </DialogHeader>

        {/* Context display */}
        {currentQuestion && (
          <div className="px-6 pb-4">
            <div className="bg-muted/50 border border-border rounded-lg p-3 space-y-1">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground">Working from</p>
                <button
                  onClick={() => setPrompt('')}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  type="button"
                >
                  Clear context
                </button>
              </div>
              <p className="text-sm line-clamp-2">{currentQuestion.question}</p>
              <div className="flex gap-2 text-xs text-muted-foreground">
                <span>{currentQuestion.topic}</span>
                <span>•</span>
                <span>{currentQuestion.difficulty}</span>
              </div>
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
                currentQuestion
                  ? 'How do you want to modify this question?'
                  : 'What do you want to learn? Be as specific or creative as you like...'
              }
              className={cn(
                'w-full resize-none rounded-lg border border-input bg-background px-3 py-2',
                'text-sm ring-offset-background placeholder:text-muted-foreground',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                'disabled:cursor-not-allowed disabled:opacity-50',
                'min-h-[80px] transition-all'
              )}
              disabled={isGenerating}
              style={{ height: '80px' }}
            />
            <p className="text-xs text-muted-foreground">
              Press {navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}+Enter to generate
            </p>
          </div>

          {/* Quick prompts */}
          {currentQuestion && (
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
