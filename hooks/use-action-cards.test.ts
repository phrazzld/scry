import { act, renderHook } from '@testing-library/react';
import { useMutation, useQuery } from 'convex/react';
import { toast } from 'sonner';
import { beforeEach, describe, expect, it, vi } from 'vitest';
// Mock api import after jest-style mocks
import { api } from '@/convex/_generated/api';
import { useActionCards } from './use-action-cards';

vi.mock('convex/react', () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/hooks/use-keyboard-shortcuts', () => ({
  useKeyboardShortcuts: vi.fn(),
}));

describe('useActionCards', () => {
  const mockCards = [
    {
      _id: 'card1',
      _creationTime: Date.now(),
      userId: 'user1',
      kind: 'MERGE_CONCEPTS',
      payload: {},
      createdAt: Date.now(),
      expiresAt: undefined,
      resolvedAt: undefined,
      resolution: undefined,
    },
  ];

  let applyMutation: any;
  let rejectMutation: any;

  beforeEach(() => {
    vi.clearAllMocks();
    (useQuery as vi.Mock).mockReturnValue(mockCards);

    applyMutation = vi.fn().mockResolvedValue({});
    rejectMutation = vi.fn().mockResolvedValue({});

    (useMutation as vi.Mock).mockImplementation((fn) => {
      if (fn === (api as any)?.iqc?.applyActionCard) return applyMutation;
      if (fn === (api as any)?.iqc?.rejectActionCard) return rejectMutation;
      return vi.fn();
    });
  });

  it('returns cards from query', () => {
    const { result } = renderHook(() => useActionCards());
    expect(result.current.cards).toHaveLength(1);
  });

  it('accepts selected card', async () => {
    const { result } = renderHook(() => useActionCards());
    await act(async () => {
      await result.current.acceptSelected();
    });
    expect(applyMutation).toHaveBeenCalledWith({ actionCardId: 'card1' });
    expect(toast.success).toHaveBeenCalledWith('Action applied');
  });

  it('rejects selected card', async () => {
    const { result } = renderHook(() => useActionCards());
    await act(async () => {
      await result.current.rejectSelected();
    });
    expect(rejectMutation).toHaveBeenCalledWith({ actionCardId: 'card1' });
    expect(toast.success).toHaveBeenCalledWith('Action rejected');
  });
});
