'use client';

import { useCallback, useState } from 'react';
import { useMutation } from 'convex/react';
import { toast } from 'sonner';
import { api } from '@/convex/_generated/api';

interface UseConceptActionsArgs {
  conceptId: string;
}

export function useConceptActions({ conceptId }: UseConceptActionsArgs) {
  const setCanonicalMutation = useMutation(api.concepts.setCanonicalPhrasing);
  const archivePhrasingMutation = useMutation(api.concepts.archivePhrasing);
  const requestGenerationMutation = useMutation(api.concepts.requestPhrasingGeneration);

  const [pendingAction, setPendingAction] = useState<'canonical' | 'archive' | 'generate' | null>(
    null
  );

  const setCanonical = useCallback(
    async (phrasingId: string | null) => {
      try {
        setPendingAction('canonical');
        await setCanonicalMutation({
          conceptId,
          phrasingId: phrasingId ?? undefined,
        });
        toast.success(phrasingId ? 'Canonical phrasing updated' : 'Canonical phrasing cleared');
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Failed to update canonical phrasing';
        toast.error(message);
      } finally {
        setPendingAction((action) => (action === 'canonical' ? null : action));
      }
    },
    [conceptId, setCanonicalMutation]
  );

  const archivePhrasing = useCallback(
    async (phrasingId: string) => {
      try {
        setPendingAction('archive');
        await archivePhrasingMutation({
          conceptId,
          phrasingId,
        });
        toast.success('Phrasing archived');
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to archive phrasing';
        toast.error(message);
      } finally {
        setPendingAction((action) => (action === 'archive' ? null : action));
      }
    },
    [conceptId, archivePhrasingMutation]
  );

  const requestMorePhrasings = useCallback(async () => {
    try {
      setPendingAction('generate');
      await requestGenerationMutation({
        conceptId,
      });
      toast.success('Generation job started');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to start generation';
      toast.error(message);
    } finally {
      setPendingAction((action) => (action === 'generate' ? null : action));
    }
  }, [conceptId, requestGenerationMutation]);

  return {
    setCanonical,
    archivePhrasing,
    requestMorePhrasings,
    isSettingCanonical: pendingAction === 'canonical',
    isArchiving: pendingAction === 'archive',
    isRequestingGeneration: pendingAction === 'generate',
  };
}
