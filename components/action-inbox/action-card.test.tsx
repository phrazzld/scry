import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Doc, Id } from '@/convex/_generated/dataModel';
import { ActionInboxCard } from './action-card';

const mockCard = (): Doc<'actionCards'> => ({
  _id: 'card1' as Id<'actionCards'>,
  _creationTime: Date.now(),
  userId: 'user1' as Id<'users'>,
  kind: 'MERGE_CONCEPTS',
  payload: {
    canonicalConceptId: 'conceptA',
    mergeConceptId: 'conceptB',
    similarity: 0.95,
    conceptSnapshots: [
      { conceptId: 'conceptA', title: 'Grace defined', phrasingCount: 3 },
      { conceptId: 'conceptB', title: 'Grace duplicate', phrasingCount: 2 },
    ],
  },
  createdAt: Date.now(),
  expiresAt: undefined,
  resolvedAt: undefined,
  resolution: undefined,
});

describe('ActionInboxCard', () => {
  it('renders concept titles and buttons', () => {
    render(<ActionInboxCard card={mockCard()} isSelected onAccept={vi.fn()} onReject={vi.fn()} />);

    expect(screen.getByText('Grace defined')).toBeInTheDocument();
    expect(screen.getByText('Grace duplicate')).toBeInTheDocument();
    expect(screen.getByText('Accept')).toBeInTheDocument();
    expect(screen.getByText('Reject')).toBeInTheDocument();
  });

  it('invokes handlers on button clicks', () => {
    const onAccept = vi.fn();
    const onReject = vi.fn();

    render(
      <ActionInboxCard card={mockCard()} isSelected onAccept={onAccept} onReject={onReject} />
    );

    fireEvent.click(screen.getByText('Accept'));
    fireEvent.click(screen.getByText('Reject'));

    expect(onAccept).toHaveBeenCalled();
    expect(onReject).toHaveBeenCalled();
  });
});
