'use client';

import { Keyboard } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface KeyboardIndicatorProps {
  onClick: () => void;
  className?: string;
}

export function KeyboardIndicator({ onClick, className = '' }: KeyboardIndicatorProps) {
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={onClick}
      className={`fixed bottom-4 right-4 z-50 bg-background/80 backdrop-blur-sm hover:bg-background/90 group ${className}`}
      aria-label="Keyboard shortcuts (press ? for help)"
      title="Press ? for keyboard shortcuts"
    >
      <Keyboard className="h-4 w-4" />
      <span className="absolute -top-1 -right-1 flex h-3 w-3">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
        <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
      </span>
      <span className="sr-only">Press ? for keyboard shortcuts</span>
    </Button>
  );
}