import { useMemo } from 'react';

/**
 * Centralized Display Mode State Machine
 *
 * Eliminates scattered conditional checks by computing a single,
 * type-safe display mode from raw state variables.
 *
 * Benefits:
 * - Single source of truth (6 state vars → 1 mode)
 * - Type-safe mode switching
 * - Explicit state transitions
 * - No scattered conditionals
 */

export type LibraryDisplayMode =
  | { type: 'loading' }
  | { type: 'searching' }
  | { type: 'search-empty'; query: string }
  | {
      type: 'search-results';
      results: unknown[];
      query: string;
      limit: number;
      canLoadMore: boolean;
    }
  | { type: 'library-empty' }
  | { type: 'library-content'; results: unknown[] };

interface UseLibraryDisplayModeProps {
  // Raw pagination data
  questions: unknown[] | undefined;

  // Search state
  searchQuery: string;
  searchResults: unknown[];
  isSearching: boolean;
  searchLimit: number;
}

/**
 * Compute the current display mode from raw state.
 *
 * State machine logic centralized in one place:
 * 1. Loading: questions not yet fetched
 * 2. Searching: active search in progress
 * 3. Search empty: search completed, 0 results
 * 4. Search results: search completed, >0 results
 * 5. Library empty: no search, 0 questions
 * 6. Library content: no search, >0 questions
 */
export function useLibraryDisplayMode(props: UseLibraryDisplayModeProps): LibraryDisplayMode {
  const { questions, searchQuery, searchResults, isSearching, searchLimit } = props;

  return useMemo(() => {
    const hasSearchQuery = searchQuery.trim().length > 0;

    // Loading: Data not yet fetched
    if (questions === undefined) {
      return { type: 'loading' };
    }

    // Searching: Active search in progress
    if (hasSearchQuery && isSearching) {
      return { type: 'searching' };
    }

    // Search empty: Search completed with 0 results
    if (hasSearchQuery && searchResults.length === 0) {
      return {
        type: 'search-empty',
        query: searchQuery.trim(),
      };
    }

    // Search results: Search completed with results
    if (hasSearchQuery && searchResults.length > 0) {
      return {
        type: 'search-results',
        results: searchResults,
        query: searchQuery.trim(),
        limit: searchLimit,
        canLoadMore: searchLimit === 20 && searchResults.length === 20,
      };
    }

    // Library empty: No search, no questions
    if (questions.length === 0) {
      return { type: 'library-empty' };
    }

    // Library content: No search, has questions
    return {
      type: 'library-content',
      results: questions,
    };
  }, [questions, searchQuery, searchResults, isSearching, searchLimit]);
}
