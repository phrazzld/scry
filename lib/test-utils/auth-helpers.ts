import { type Mock } from 'vitest';

/**
 * Test utilities for mocking Clerk authentication in unit tests
 */

/**
 * Default mock user data for tests
 */
export const mockUserData = {
  id: 'test-user-123',
  firstName: 'Test',
  lastName: 'User',
  fullName: 'Test User',
  username: 'testuser',
  emailAddresses: [
    {
      emailAddress: 'test@example.com',
      id: 'email-123',
    },
  ],
  primaryEmailAddress: {
    emailAddress: 'test@example.com',
    id: 'email-123',
  },
  imageUrl: 'https://example.com/avatar.jpg',
};

/**
 * Create a mock useUser hook with customizable return values
 */
export function mockUseUser(
  overrides?: Partial<{
    isSignedIn: boolean;
    isLoaded: boolean;
    user: typeof mockUserData | null;
  }>
) {
  return {
    isSignedIn: true,
    isLoaded: true,
    user: mockUserData,
    ...overrides,
  };
}

/**
 * Create a mock useAuth hook with customizable return values
 */
export function mockUseAuth(
  overrides?: Partial<{
    isSignedIn: boolean;
    isLoaded: boolean;
    userId: string | null;
    sessionId: string | null;
    signOut: Mock;
    getToken: Mock;
  }>
) {
  return {
    isSignedIn: true,
    isLoaded: true,
    userId: 'test-user-123',
    sessionId: 'test-session-456',
    signOut: overrides?.signOut || (() => Promise.resolve()),
    getToken: overrides?.getToken || (() => Promise.resolve('test-token')),
    ...overrides,
  };
}

/**
 * Create a mock useClerk hook with common clerk methods
 */
export function mockUseClerk(
  overrides?: Partial<{
    signOut: Mock;
    signIn: Mock;
    openSignIn: Mock;
    openSignUp: Mock;
    openUserProfile: Mock;
    redirectToSignIn: Mock;
    redirectToSignUp: Mock;
  }>
) {
  return {
    signOut: overrides?.signOut || (() => Promise.resolve()),
    signIn: overrides?.signIn || (() => Promise.resolve()),
    openSignIn: overrides?.openSignIn || (() => {}),
    openSignUp: overrides?.openSignUp || (() => {}),
    openUserProfile: overrides?.openUserProfile || (() => {}),
    redirectToSignIn: overrides?.redirectToSignIn || (() => Promise.resolve()),
    redirectToSignUp: overrides?.redirectToSignUp || (() => Promise.resolve()),
    ...overrides,
  };
}

/**
 * Create a mock ClerkProvider for wrapping components in tests
 * Note: This returns a function component that should be used in test mocks
 */
export function createMockClerkProvider() {
  return function MockClerkProvider({ children }: { children: React.ReactNode }) {
    return children;
  };
}

/**
 * Setup all Clerk mocks for a test file
 * Use this in your test file's setup to mock all Clerk hooks at once
 *
 * @example
 * ```ts
 * import { setupClerkMocks } from '@/lib/test-utils/auth-helpers';
 * import { vi } from 'vitest';
 *
 * vi.mock('@clerk/nextjs', () => setupClerkMocks());
 * ```
 */
export function setupClerkMocks(options?: {
  userOverrides?: Parameters<typeof mockUseUser>[0];
  authOverrides?: Parameters<typeof mockUseAuth>[0];
  clerkOverrides?: Parameters<typeof mockUseClerk>[0];
}) {
  return {
    useUser: () => mockUseUser(options?.userOverrides),
    useAuth: () => mockUseAuth(options?.authOverrides),
    useClerk: () => mockUseClerk(options?.clerkOverrides),
    ClerkProvider: createMockClerkProvider(),
    SignedIn: ({ children }: { children: React.ReactNode }) => children,
    SignedOut: () => null,
    SignIn: () => null,
    SignUp: () => null,
    UserButton: () => null,
  };
}

/**
 * Create a mock user for a specific test scenario
 */
export function createMockUser(overrides?: Partial<typeof mockUserData>) {
  return {
    ...mockUserData,
    ...overrides,
  };
}

/**
 * Mock an unauthenticated state
 */
export function mockUnauthenticatedState() {
  return {
    isSignedIn: false,
    isLoaded: true,
    user: null,
    userId: null,
    sessionId: null,
  };
}

/**
 * Mock a loading authentication state
 */
export function mockLoadingAuthState() {
  return {
    isSignedIn: false,
    isLoaded: false,
    user: null,
    userId: null,
    sessionId: null,
  };
}
