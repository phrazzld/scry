import { act, renderHook } from '@testing-library/react';
import { useMutation } from 'convex/react';
import { toast } from 'sonner';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { useConceptActions } from './use-concept-actions';

vi.mock('convex/react', () => ({
  useMutation: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/convex/_generated/api', () => ({
  api: {
    concepts: {
      setCanonicalPhrasing: { _functionPath: 'concepts:setCanonicalPhrasing' },
      archivePhrasing: { _functionPath: 'concepts:archivePhrasing' },
      requestPhrasingGeneration: { _functionPath: 'concepts:requestPhrasingGeneration' },
    },
  },
}));

describe('useConceptActions', () => {
  const conceptId = 'concept_1';
  let mockSetCanonical: any;
  let mockArchive: any;
  let mockGenerate: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockSetCanonical = vi.fn().mockResolvedValue({});
    mockArchive = vi.fn().mockResolvedValue({});
    mockGenerate = vi.fn().mockResolvedValue({});

    (useMutation as unknown as Mock).mockImplementation((mutation: any) => {
      switch (mutation?._functionPath) {
        case 'concepts:setCanonicalPhrasing':
          return mockSetCanonical;
        case 'concepts:archivePhrasing':
          return mockArchive;
        case 'concepts:requestPhrasingGeneration':
          return mockGenerate;
        default:
          return vi.fn();
      }
    });
  });

  it('sets canonical phrasing', async () => {
    const { result } = renderHook(() => useConceptActions({ conceptId }));

    await act(async () => {
      await result.current.setCanonical('phrasing_1');
    });

    expect(mockSetCanonical).toHaveBeenCalledWith({
      conceptId,
      phrasingId: 'phrasing_1',
    });
    expect(toast.success).toHaveBeenCalledWith('Canonical phrasing updated');
  });

  it('archives phrasing', async () => {
    const { result } = renderHook(() => useConceptActions({ conceptId }));

    await act(async () => {
      await result.current.archivePhrasing('phrasing_2');
    });

    expect(mockArchive).toHaveBeenCalledWith({
      conceptId,
      phrasingId: 'phrasing_2',
    });
    expect(toast.success).toHaveBeenCalledWith('Phrasing archived');
  });

  it('requests generation', async () => {
    const { result } = renderHook(() => useConceptActions({ conceptId }));

    await act(async () => {
      await result.current.requestMorePhrasings();
    });

    expect(mockGenerate).toHaveBeenCalledWith({ conceptId });
    expect(toast.success).toHaveBeenCalledWith('Generation job started');
  });
});
