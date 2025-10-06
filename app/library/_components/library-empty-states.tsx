'use client';

import { useState } from 'react';
import { Archive, BookOpen, Trash2 } from 'lucide-react';

import { GenerationModal } from '@/components/generation-modal';
import { Button } from '@/components/ui/button';

export function ActiveEmptyState() {
  const [generateOpen, setGenerateOpen] = useState(false);

  return (
    <>
      <div className="text-center py-16 px-4">
        <BookOpen className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" strokeWidth={1.5} />
        <h3 className="text-xl font-semibold mb-2">Your library is empty</h3>
        <p className="text-muted-foreground mb-6 max-w-md mx-auto">
          Generate your first questions to start learning
        </p>
        <Button onClick={() => setGenerateOpen(true)} size="lg">
          Generate Questions
        </Button>
      </div>

      <GenerationModal open={generateOpen} onOpenChange={setGenerateOpen} />
    </>
  );
}

export function ArchivedEmptyState() {
  return (
    <div className="text-center py-16 px-4">
      <Archive className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" strokeWidth={1.5} />
      <h3 className="text-xl font-semibold mb-2">No archived questions</h3>
      <p className="text-muted-foreground max-w-md mx-auto">
        Archive questions to pause learning without deleting them
      </p>
    </div>
  );
}

export function TrashEmptyState() {
  return (
    <div className="text-center py-16 px-4">
      <Trash2 className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" strokeWidth={1.5} />
      <h3 className="text-xl font-semibold mb-2">Trash is empty</h3>
      <p className="text-muted-foreground max-w-md mx-auto">
        Deleted questions will appear here for 30 days
      </p>
    </div>
  );
}
