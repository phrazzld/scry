'use client';

import * as React from 'react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// Helper to generate unique IDs with fallback for environments without crypto.randomUUID
function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback: timestamp + random for older browsers and test environments
  return `conf-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

// Types
type ConfirmationOptions = {
  title: React.ReactNode;
  description: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: 'default' | 'destructive';
  requireTyping?: string;
};

type ConfirmationRequest = {
  id: string;
  options: ConfirmationOptions;
  resolve: (confirmed: boolean) => void;
  triggerRef: React.RefObject<HTMLElement>;
};

type ConfirmationFn = (options: ConfirmationOptions) => Promise<boolean>;

// Context
const ConfirmationContext = React.createContext<ConfirmationFn | null>(null);

/**
 * Provider component for confirmation dialogs
 *
 * Manages a queue of confirmation requests to prevent race conditions.
 * Only one dialog is visible at a time (FIFO order).
 *
 * Must wrap the app root to make useConfirmation() available globally.
 *
 * @example
 * <ConfirmationProvider>
 *   <App />
 * </ConfirmationProvider>
 */
export function ConfirmationProvider({ children }: { children: React.ReactNode }) {
  const [queue, setQueue] = React.useState<ConfirmationRequest[]>([]);
  const [typedText, setTypedText] = React.useState('');

  const activeRequest = queue[0];
  const requireTyping = activeRequest?.options.requireTyping;
  const isTypingValid = !requireTyping || typedText.toLowerCase() === requireTyping.toLowerCase();

  const confirm = React.useCallback((options: ConfirmationOptions) => {
    return new Promise<boolean>((resolve) => {
      setQueue((prev) => [
        ...prev,
        {
          id: generateId(),
          options,
          resolve,
          triggerRef: { current: document.activeElement as HTMLElement },
        },
      ]);
    });
  }, []);

  const handleClose = React.useCallback(
    (confirmed: boolean) => {
      if (!activeRequest) return;

      activeRequest.resolve(confirmed);

      // Focus restoration with fallback
      try {
        const trigger = activeRequest.triggerRef.current;
        if (trigger && document.contains(trigger)) {
          trigger.focus();
        } else {
          // Fallback: Focus first focusable element or body
          const firstFocusable = document.querySelector<HTMLElement>(
            'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
          );
          if (firstFocusable) {
            firstFocusable.focus();
          } else {
            document.body.focus();
          }
        }
      } catch (error) {
        console.warn('Failed to restore focus:', error);
        document.body.focus();
      }

      setQueue((prev) => prev.slice(1));
      setTypedText(''); // Reset for next confirmation
    },
    [activeRequest]
  );

  return (
    <ConfirmationContext.Provider value={confirm}>
      {children}
      {activeRequest && (
        <AlertDialog open={true}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{activeRequest.options.title}</AlertDialogTitle>
              <AlertDialogDescription>{activeRequest.options.description}</AlertDialogDescription>
            </AlertDialogHeader>

            {requireTyping && (
              <div className="space-y-2">
                <Label htmlFor="confirm-typing">Type &quot;{requireTyping}&quot; to confirm:</Label>
                <Input
                  id="confirm-typing"
                  value={typedText}
                  onChange={(e) => setTypedText(e.target.value)}
                  placeholder={requireTyping}
                  autoFocus
                  className={typedText && !isTypingValid ? 'border-error' : ''}
                />
                {typedText && !isTypingValid && (
                  <p className="text-xs text-error">Text does not match</p>
                )}
              </div>
            )}

            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => handleClose(false)}>
                {activeRequest.options.cancelText || 'Cancel'}
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => handleClose(true)}
                disabled={!isTypingValid}
                className={
                  activeRequest.options.variant === 'destructive'
                    ? 'bg-error hover:bg-error/90'
                    : ''
                }
              >
                {activeRequest.options.confirmText || 'Confirm'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </ConfirmationContext.Provider>
  );
}

/**
 * Hook for showing confirmation dialogs
 *
 * Returns a promise-based confirm function that blocks until user responds.
 * Handles focus restoration and keyboard navigation automatically.
 *
 * @throws {Error} If used outside ConfirmationProvider
 *
 * @example
 * const confirm = useConfirmation();
 * const confirmed = await confirm({
 *   title: 'Delete item?',
 *   description: 'This action cannot be undone.',
 *   variant: 'destructive',
 *   requireTyping: 'DELETE', // Optional: require typing text to confirm
 * });
 * if (confirmed) {
 *   await deleteItem();
 * }
 */
export function useConfirmation() {
  const context = React.useContext(ConfirmationContext);
  if (!context) {
    throw new Error('useConfirmation must be used within a ConfirmationProvider');
  }
  return context;
}
