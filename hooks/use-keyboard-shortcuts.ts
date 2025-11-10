import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

export interface ShortcutDefinition {
  key: string;
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
  description: string;
  action: () => void;
  context?: 'global' | 'review' | 'editing';
}

export function useKeyboardShortcuts(shortcuts: ShortcutDefinition[], enabled = true) {
  const router = useRouter();
  const [showHelp, setShowHelp] = useState(false);

  // Global shortcuts that work anywhere
  const globalShortcuts: ShortcutDefinition[] = [
    {
      key: '?',
      description: 'Show keyboard shortcuts help',
      action: () => setShowHelp((prev) => !prev),
      context: 'global',
    },
    {
      key: 'h',
      description: 'Go to home/review',
      action: () => router.push('/'),
      context: 'global',
    },
    {
      key: 'c',
      description: 'Go to concepts',
      action: () => router.push('/concepts'),
      context: 'global',
    },
    {
      key: 's',
      ctrl: true,
      description: 'Go to settings',
      action: () => {
        router.push('/settings');
        toast.info('Opening settings...');
      },
      context: 'global',
    },
    {
      key: 'g',
      description: 'Generate new questions',
      action: () => {
        // Dispatch event to open generation modal
        window.dispatchEvent(new CustomEvent('open-generation-modal'));
      },
      context: 'global',
    },
    {
      key: 'Escape',
      description: 'Close modals/cancel editing',
      action: () => {
        // Dispatch a custom event that components can listen to
        window.dispatchEvent(new CustomEvent('escape-pressed'));
      },
      context: 'global',
    },
  ];

  const handleKeyPress = useCallback(
    (e: KeyboardEvent) => {
      // Don't handle shortcuts if user is typing in an input (unless it's a global shortcut with modifier)
      const isTyping =
        e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
      const hasModifier = e.ctrlKey || e.metaKey || e.altKey;

      if (isTyping && !hasModifier) {
        return;
      }

      // Combine user shortcuts with global shortcuts
      const allShortcuts = [...globalShortcuts, ...shortcuts];

      // Find matching shortcut
      const matchingShortcut = allShortcuts.find((shortcut) => {
        const keyMatch =
          e.key.toLowerCase() === shortcut.key.toLowerCase() || e.key === shortcut.key;
        const ctrlMatch = !shortcut.ctrl || e.ctrlKey || e.metaKey;
        const altMatch = !shortcut.alt || e.altKey;
        const shiftMatch = !shortcut.shift || e.shiftKey;

        return keyMatch && ctrlMatch && altMatch && shiftMatch;
      });

      if (matchingShortcut) {
        e.preventDefault();
        matchingShortcut.action();
      }
    },
    [shortcuts, router]
  );

  useEffect(() => {
    if (!enabled) return;

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [handleKeyPress, enabled]);

  return {
    showHelp,
    setShowHelp,
    shortcuts: [...globalShortcuts, ...shortcuts],
  };
}

// Review-specific shortcuts hook
export function useReviewShortcuts({
  onSelectAnswer,
  onSubmit,
  onNext,
  onEdit,
  onDelete,
  onUndo,
  onGenerateFromContext,
  showingFeedback,
  isAnswering,
  canSubmit,
}: {
  onSelectAnswer?: (index: number) => void;
  onSubmit?: () => void;
  onNext?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onUndo?: () => void;
  onGenerateFromContext?: () => void;
  showingFeedback?: boolean;
  isAnswering?: boolean;
  canSubmit?: boolean;
}) {
  const shortcuts: ShortcutDefinition[] = [];

  // Answer selection shortcuts (1-4)
  if (onSelectAnswer && !showingFeedback) {
    for (let i = 1; i <= 4; i++) {
      shortcuts.push({
        key: String(i),
        description: `Select answer ${i}`,
        action: () => onSelectAnswer(i - 1),
        context: 'review',
      });
    }
  }

  // Submit/Next shortcuts
  if (showingFeedback) {
    if (onNext) {
      shortcuts.push({
        key: 'Enter',
        description: 'Next question',
        action: onNext,
        context: 'review',
      });
      shortcuts.push({
        key: ' ',
        description: 'Next question',
        action: onNext,
        context: 'review',
      });
      shortcuts.push({
        key: 'ArrowRight',
        description: 'Next question',
        action: onNext,
        context: 'review',
      });
    }
  } else {
    if (onSubmit && canSubmit && !isAnswering) {
      shortcuts.push({
        key: 'Enter',
        description: 'Submit answer',
        action: onSubmit,
        context: 'review',
      });
    }
  }

  // Edit/Delete shortcuts
  if (onEdit) {
    shortcuts.push({
      key: 'e',
      description: 'Edit question',
      action: onEdit,
      context: 'review',
    });
  }

  if (onDelete) {
    shortcuts.push({
      key: 'd',
      description: 'Delete question',
      action: onDelete,
      context: 'review',
    });
    shortcuts.push({
      key: 'Delete',
      description: 'Delete question',
      action: onDelete,
      context: 'review',
    });
  }

  if (onUndo) {
    shortcuts.push({
      key: 'z',
      ctrl: true,
      description: 'Undo last action',
      action: onUndo,
      context: 'review',
    });
  }

  // Skip question (mark as difficult)
  shortcuts.push({
    key: 's',
    description: 'Skip question (mark difficult)',
    action: () => {
      toast.info('Question marked as difficult and skipped');
      if (onNext) onNext();
    },
    context: 'review',
  });

  // Toggle explanation
  shortcuts.push({
    key: 'x',
    description: 'Show/hide explanation',
    action: () => {
      const explanation = document.querySelector('[data-explanation]');
      if (explanation) {
        explanation.classList.toggle('hidden');
      }
    },
    context: 'review',
  });

  // Generate new questions from current context
  if (onGenerateFromContext) {
    shortcuts.push({
      key: 'n',
      description: 'Generate new questions from this one',
      action: onGenerateFromContext,
      context: 'review',
    });
  }

  return useKeyboardShortcuts(shortcuts, true);
}
