'use client';

import { useCallback, useMemo, useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { toast } from 'sonner';
import { api } from '@/convex/_generated/api';
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts';

export function useActionCards() {
  const cards = useQuery(api.iqc.getOpenCards, { limit: 50 });
  const applyCard = useMutation(api.iqc.applyActionCard);
  const rejectCard = useMutation(api.iqc.rejectActionCard);

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);

  const normalizedCards = useMemo(() => cards ?? [], [cards]);

  const selectOffset = useCallback(
    (delta: number) => {
      setSelectedIndex((prev) => {
        if (normalizedCards.length === 0) return 0;
        const next = (prev + delta + normalizedCards.length) % normalizedCards.length;
        return next;
      });
    },
    [normalizedCards]
  );

  const selectedCard = normalizedCards[selectedIndex] ?? null;

  const refetching = cards === undefined;

  const acceptSelected = useCallback(async () => {
    if (!selectedCard) return;
    try {
      setPendingActionId(selectedCard._id);
      await applyCard({
        actionCardId: selectedCard._id,
      });
      toast.success('Action applied');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to apply action';
      toast.error(message);
    } finally {
      setPendingActionId(null);
    }
  }, [applyCard, selectedCard]);

  const rejectSelected = useCallback(async () => {
    if (!selectedCard) return;
    try {
      setPendingActionId(selectedCard._id);
      await rejectCard({
        actionCardId: selectedCard._id,
      });
      toast.success('Action rejected');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to reject action';
      toast.error(message);
    } finally {
      setPendingActionId(null);
    }
  }, [rejectCard, selectedCard]);

  useKeyboardShortcuts(
    [
      {
        key: 'j',
        description: 'Next action card',
        action: () => selectOffset(1),
        context: 'global',
      },
      {
        key: 'k',
        description: 'Previous action card',
        action: () => selectOffset(-1),
        context: 'global',
      },
      {
        key: 'Enter',
        description: 'Accept action card',
        action: acceptSelected,
        context: 'global',
      },
    ],
    normalizedCards.length > 0
  );

  return {
    cards: normalizedCards,
    isLoading: refetching,
    selectedIndex: normalizedCards.length === 0 ? -1 : selectedIndex % normalizedCards.length,
    selectOffset,
    setSelectedIndex,
    acceptSelected,
    rejectSelected,
    selectedCard,
    pendingActionId,
  };
}
