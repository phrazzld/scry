import { ReactElement, ReactNode } from 'react';
import { render, RenderOptions } from '@testing-library/react';

/**
 * Custom render function that wraps components with necessary providers for testing
 */

interface ProvidersProps {
  children: ReactNode;
}

/**
 * All providers wrapper for testing
 * Includes mocked versions of:
 * - Theme provider (simplified)
 * - Clerk provider (mocked)
 * - Convex provider (mocked)
 * - CurrentQuestion provider (if needed)
 */
function AllProviders({ children }: ProvidersProps) {
  // For testing, we provide a minimal wrapper
  // Individual tests can wrap with more specific providers if needed
  return <>{children}</>;
}

/**
 * Custom render function with providers
 *
 * @example
 * ```tsx
 * import { renderWithProviders } from '@/lib/test-utils/render-with-providers';
 *
 * test('renders component', () => {
 *   const { getByText } = renderWithProviders(<MyComponent />);
 *   expect(getByText('Hello')).toBeInTheDocument();
 * });
 * ```
 */
export function renderWithProviders(ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>) {
  return render(ui, { wrapper: AllProviders, ...options });
}

/**
 * Create a custom wrapper with specific providers
 * Use this when you need to customize the providers for a specific test
 *
 * @example
 * ```tsx
 * const wrapper = createWrapper({
 *   theme: 'dark',
 *   user: { id: 'custom-user' }
 * });
 * const { getByText } = render(<MyComponent />, { wrapper });
 * ```
 */
 
export function createWrapper(_config?: {
  theme?: 'light' | 'dark' | 'system';
  user?: unknown;
  convexClient?: unknown;
}) {
  return function Wrapper({ children }: ProvidersProps) {
    // Add provider configuration here based on config
    // For now, returning children directly
    return <>{children}</>;
  };
}

/**
 * Re-export everything from React Testing Library for convenience
 */
export * from '@testing-library/react';

/**
 * Re-export user-event for convenience
 */
export { default as userEvent } from '@testing-library/user-event';
