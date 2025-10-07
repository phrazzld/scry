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

// Provider
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
          id: crypto.randomUUID(),
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
      activeRequest.triggerRef.current?.focus();
      setQueue((prev) => prev.slice(1));
      setTypedText(''); // Reset for next confirmation
    },
    [activeRequest]
  );

  return (
    <ConfirmationContext.Provider value={confirm}>
      {children}
      {activeRequest && (
        <AlertDialog open={true} onOpenChange={() => handleClose(false)}>
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

// Consumer hook
export function useConfirmation() {
  const context = React.useContext(ConfirmationContext);
  if (!context) {
    throw new Error('useConfirmation must be used within a ConfirmationProvider');
  }
  return context;
}
