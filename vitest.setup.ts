import React from 'react';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
// Make React globally available for JSX in tests
globalThis.React = React;

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock Convex for testing
vi.mock('convex/react', () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
  useAction: vi.fn(),
}));

// Global test utilities
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));
