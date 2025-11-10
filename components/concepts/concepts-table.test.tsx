import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Doc, Id } from '@/convex/_generated/dataModel';
import { initializeConceptFsrs } from '@/convex/fsrs';
import { ConceptsTable } from './concepts-table';

function createConcept(overrides: Partial<Doc<'concepts'>> = {}): Doc<'concepts'> {
  return {
    _id: ('concept_' + Math.random()) as Id<'concepts'>,
    _creationTime: Date.now(),
    userId: 'user_1' as Id<'users'>,
    title: 'Sample Concept',
    description: 'Explains something important',
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
    ...overrides,
  };
}

describe('ConceptsTable', () => {
  it('renders concept title and description', () => {
    const concept = createConcept();
    render(<ConceptsTable concepts={[concept]} serverTime={Date.now()} />);

    expect(screen.getByText('Sample Concept')).toBeInTheDocument();
    expect(screen.getByText('Explains something important')).toBeInTheDocument();
  });

  it('shows due badge when next review is in the past', () => {
    const concept = createConcept({
      fsrs: {
        ...createConcept().fsrs,
        nextReview: Date.now() - 1000,
      },
    });

    render(<ConceptsTable concepts={[concept]} serverTime={Date.now()} />);

    expect(screen.getByText('Due now')).toBeInTheDocument();
  });

  it('displays thin and conflict badges when signals present', () => {
    const concept = createConcept({
      thinScore: 1,
      conflictScore: 2,
    });

    render(<ConceptsTable concepts={[concept]} serverTime={Date.now()} />);

    expect(screen.getByText('Thin')).toBeInTheDocument();
    expect(screen.getByText('Conflict')).toBeInTheDocument();
  });
});
