import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Doc, Id } from '@/convex/_generated/dataModel';
import { initializeConceptFsrs } from '@/convex/fsrs';
import { ConceptDetail } from './concept-detail';

const baseConcept = (): Doc<'concepts'> => ({
  _id: 'concept1' as Id<'concepts'>,
  _creationTime: Date.now(),
  userId: 'user1' as Id<'users'>,
  title: 'Doctrine of Grace',
  description: 'Explains the Catholic understanding of grace.',
  fsrs: initializeConceptFsrs(new Date('2024-01-01')),
  phrasingCount: 2,
  conflictScore: undefined,
  thinScore: undefined,
  qualityScore: undefined,
  embedding: undefined,
  embeddingGeneratedAt: undefined,
  createdAt: Date.now(),
  updatedAt: undefined,
  generationJobId: undefined,
  canonicalPhrasingId: undefined,
});

const phrasing = (): Doc<'phrasings'> => ({
  _id: 'phrasing1' as Id<'phrasings'>,
  _creationTime: Date.now(),
  userId: 'user1' as Id<'users'>,
  conceptId: 'concept1' as Id<'concepts'>,
  question: 'What is actual grace?',
  explanation: 'Assistance from God for salutary acts.',
  type: 'multiple-choice',
  options: [],
  correctAnswer: '',
  attemptCount: 0,
  correctCount: 0,
  createdAt: Date.now(),
  updatedAt: Date.now(),
  archivedAt: undefined,
  deletedAt: undefined,
  embedding: undefined,
  embeddingGeneratedAt: undefined,
});

describe('ConceptDetail', () => {
  it('renders concept metadata and phrasings', () => {
    render(
      <ConceptDetail
        concept={baseConcept()}
        phrasings={[phrasing()]}
        pendingGeneration={false}
        onGenerate={vi.fn()}
        onSetCanonical={vi.fn()}
        onArchive={vi.fn()}
        isSettingCanonical={false}
        isArchiving={false}
        isRequestingGeneration={false}
      />
    );

    expect(screen.getByText('Doctrine of Grace')).toBeInTheDocument();
    expect(screen.getByText('What is actual grace?')).toBeInTheDocument();
  });

  it('invokes action handlers when buttons clicked', () => {
    const setCanonical = vi.fn().mockResolvedValue(undefined);
    const archive = vi.fn().mockResolvedValue(undefined);

    render(
      <ConceptDetail
        concept={baseConcept()}
        phrasings={[phrasing()]}
        pendingGeneration={false}
        onGenerate={vi.fn()}
        onSetCanonical={setCanonical}
        onArchive={archive}
        isSettingCanonical={false}
        isArchiving={false}
        isRequestingGeneration={false}
      />
    );

    fireEvent.click(screen.getByText('Set canonical'));
    expect(setCanonical).toHaveBeenCalled();

    fireEvent.click(screen.getByText('Archive'));
    expect(archive).toHaveBeenCalled();
  });
});
