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
      className={`relative bg-background/80 backdrop-blur-sm hover:bg-background/90 group ${className}`}
      aria-label="Keyboard shortcuts (press ? for help)"
      title="Press ? for keyboard shortcuts"
    >
      <Keyboard className="h-4 w-4" />
      <span className="sr-only">Press ? for keyboard shortcuts</span>
    </Button>
  );
}
