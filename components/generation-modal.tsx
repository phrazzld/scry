'use client';

import * as React from 'react';
import { useMutation } from 'convex/react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/convex/_generated/api';
import { AUTO_FOCUS_DELAY, TOAST_DURATION } from '@/lib/constants/ui';
import { handleJobCreationError } from '@/lib/error-handlers';

interface GenerationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGenerationSuccess?: (count: number) => void;
}

const DRAFT_STORAGE_KEY = 'scry-generation-draft';
const AUTO_SAVE_DEBOUNCE = 2000; // 2 seconds

export function GenerationModal({ open, onOpenChange, onGenerationSuccess }: GenerationModalProps) {
  const [prompt, setPrompt] = React.useState('');
  const [isGenerating, setIsGenerating] = React.useState(false);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const createJob = useMutation(api.generationJobs.createJob);

  // Auto-focus textarea and restore draft when modal opens
  React.useEffect(() => {
    if (open) {
      // Restore draft from localStorage
      const draft = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (draft && !prompt) {
        setPrompt(draft);
        toast.info('Draft restored', {
          duration: 2000,
        });
      }

      // Auto-focus after a short delay
      setTimeout(() => {
        textareaRef.current?.focus();
      }, AUTO_FOCUS_DELAY);
    } else {
      // Clear prompt when closing (don't clear localStorage - keep draft)
      setPrompt('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Auto-save draft to localStorage (debounced)
  React.useEffect(() => {
    if (prompt) {
      const timer = setTimeout(() => {
        localStorage.setItem(DRAFT_STORAGE_KEY, prompt);
      }, AUTO_SAVE_DEBOUNCE);
      return () => clearTimeout(timer);
    }
  }, [prompt]);

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

      // Clear draft on successful submission
      localStorage.removeItem(DRAFT_STORAGE_KEY);

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
        <DialogHeader>
          <DialogTitle className="text-xl sm:text-2xl">Generate New Questions</DialogTitle>
          <DialogDescription>Create questions about any topic using AI</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-3">
            <Label htmlFor="prompt">What do you want to learn?</Label>
            <Textarea
              id="prompt"
              ref={textareaRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Be specific for better questions..."
              className="h-36 resize-none"
              disabled={isGenerating}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isGenerating}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!prompt.trim() || isGenerating}
              className="min-w-[120px]"
              data-testid="generate-quiz-button"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Starting...
                </>
              ) : (
                'Generate'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
