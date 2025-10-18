'use client';

import * as React from 'react';
import { useMutation } from 'convex/react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { api } from '@/convex/_generated/api';
import { AUTO_FOCUS_DELAY, TOAST_DURATION } from '@/lib/constants/ui';
import { handleJobCreationError } from '@/lib/error-handlers';
import { cn } from '@/lib/utils';

interface GenerationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGenerationSuccess?: (count: number) => void;
}

export function GenerationModal({ open, onOpenChange, onGenerationSuccess }: GenerationModalProps) {
  const [prompt, setPrompt] = React.useState('');
  const [isGenerating, setIsGenerating] = React.useState(false);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const createJob = useMutation(api.generationJobs.createJob);

  // Auto-focus textarea when modal opens
  React.useEffect(() => {
    if (open) {
      setTimeout(() => {
        textareaRef.current?.focus();
      }, AUTO_FOCUS_DELAY);
    } else {
      // Clear prompt when closing
      setPrompt('');
    }
  }, [open]);

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!prompt.trim()) return;

    const submittedPrompt = prompt;

    // Close modal immediately for better UX (non-blocking generation)
    onOpenChange(false);
    setPrompt('');
    setIsGenerating(true);

    try {
      await createJob({ prompt: submittedPrompt });

      toast.success('Generation started', {
        description: 'Check Background Tasks to monitor progress',
        duration: TOAST_DURATION.SUCCESS,
      });

      onGenerationSuccess?.(0); // Call callback with 0 since we don't know count yet
    } catch (error) {
      handleJobCreationError(error);
    } finally {
      setIsGenerating(false);
    }
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
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader className="pb-6">
          <DialogTitle className="text-xl">Generate New Questions</DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">Create questions about any topic</p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Textarea */}
          <div className="space-y-2">
            <textarea
              ref={textareaRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Describe what you want to learn... (be specific for better questions)"
              className={cn(
                'w-full resize-none rounded-lg border border-input bg-background px-3 py-2',
                'text-sm ring-offset-background placeholder:text-muted-foreground',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                'transition-all duration-200 focus:border-primary/50',
                'disabled:cursor-not-allowed disabled:opacity-50',
                'h-32'
              )}
              disabled={isGenerating}
            />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <p>
                Press{' '}
                {typeof navigator !== 'undefined' && navigator.platform.includes('Mac')
                  ? '⌘'
                  : 'Ctrl'}
                +Enter to generate
              </p>
              <p className="tabular-nums">
                {prompt.length} {prompt.length === 1 ? 'character' : 'characters'}
              </p>
            </div>
          </div>

          {/* Submit button */}
          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={!prompt.trim() || isGenerating}
              className="min-w-[120px] transition-all duration-200 hover:scale-105 active:scale-95"
              data-testid="generate-quiz-button"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  <span className="animate-pulse">Starting...</span>
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
