'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';

interface GeneratePhrasingsDialogProps {
  onConfirm: () => Promise<void>;
  disabled?: boolean;
  pending?: boolean;
}

export function GeneratePhrasingsDialog({
  onConfirm,
  disabled,
  pending,
}: GeneratePhrasingsDialogProps) {
  const [open, setOpen] = useState(false);

  const handleConfirm = async () => {
    await onConfirm();
    setOpen(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button disabled={disabled || pending}>
          {pending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
              Generation in progress
            </>
          ) : (
            'Generate more phrasings'
          )}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Generate more phrasings?</AlertDialogTitle>
          <AlertDialogDescription>
            This triggers the Stage B generator to propose new phrasings for this concept. Each run
            attempts to add up to four review-ready prompts.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm} disabled={pending}>
            {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : null}
            Generate
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
