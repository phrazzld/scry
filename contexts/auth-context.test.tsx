import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from '@/contexts/auth-context';
import { toast } from 'sonner';

// Mock dependencies
vi.mock('convex/react', () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ 
    push: vi.fn(),
    refresh: vi.fn(),
  })),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/lib/auth-cookies', () => ({
  setClientSessionCookie: vi.fn(),
  removeClientSessionCookie: vi.fn(),
  getSessionCookie: vi.fn(),
}));

vi.mock('@/lib/environment-client', () => ({
  getClientEnvironment: vi.fn(() => 'development'),
}));

vi.mock('@/lib/storage', () => ({
  safeStorage: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
}));

import { useQuery, useMutation } from 'convex/react';
import { useRouter } from 'next/navigation';
import { setClientSessionCookie, removeClientSessionCookie, getSessionCookie } from '@/lib/auth-cookies';
import { safeStorage } from '@/lib/storage';

describe('AuthContext', () => {
  let mockUser: any;
  let mockVerifyMagicLink: any;
  let mockSignOut: any;
  let mockUpdateProfile: any;
  let mockDeleteAccount: any;
  let mockRouter: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup default mocks
    mockUser = { 
      id: 'user-1', 
      email: 'test@example.com', 
      name: 'Test User' 
    };
    
    mockVerifyMagicLink = vi.fn();
    mockSignOut = vi.fn();
    mockUpdateProfile = vi.fn();
    mockDeleteAccount = vi.fn();
    mockRouter = { push: vi.fn(), refresh: vi.fn() };
    
    (useRouter as any).mockReturnValue(mockRouter);
    (useQuery as any).mockReturnValue(mockUser);
    (useMutation as any).mockImplementation((mutation: any) => {
      if (mutation._name === 'verifyMagicLink') return mockVerifyMagicLink;
      if (mutation._name === 'signOut') return mockSignOut;
      if (mutation._name === 'updateProfile') return mockUpdateProfile;
      if (mutation._name === 'deleteAccount') return mockDeleteAccount;
      return vi.fn();
    });
    
    // Mock fetch globally
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Provider initialization', () => {
    it('should load session token from localStorage on mount', () => {
      const mockToken = 'stored-token';
      (safeStorage.getItem as any).mockReturnValue(mockToken);
      (getSessionCookie as any).mockReturnValue(null);
      
      const wrapper = ({ children }: any) => (
        <AuthProvider>{children}</AuthProvider>
      );
      
      const { result } = renderHook(() => useAuth(), { wrapper });
      
      expect(safeStorage.getItem).toHaveBeenCalledWith('scry_session_token');
      expect(result.current.sessionToken).toBe(mockToken);
      expect(result.current.isLoading).toBe(false);
    });

    it('should load session token from cookie if localStorage is empty', () => {
      const mockToken = 'cookie-token';
      (safeStorage.getItem as any).mockReturnValue(null);
      (getSessionCookie as any).mockReturnValue(mockToken);
      
      const wrapper = ({ children }: any) => (
        <AuthProvider>{children}</AuthProvider>
      );
      
      const { result } = renderHook(() => useAuth(), { wrapper });
      
      expect(getSessionCookie).toHaveBeenCalled();
      expect(result.current.sessionToken).toBe(mockToken);
      // Should sync to localStorage
      expect(safeStorage.setItem).toHaveBeenCalledWith('scry_session_token', mockToken);
    });

    it('should sync tokens between localStorage and cookies', () => {
      const mockToken = 'sync-token';
      (safeStorage.getItem as any).mockReturnValue(mockToken);
      (getSessionCookie as any).mockReturnValue(null);
      
      const wrapper = ({ children }: any) => (
        <AuthProvider>{children}</AuthProvider>
      );
      
      renderHook(() => useAuth(), { wrapper });
      
      // Should sync to cookie
      expect(setClientSessionCookie).toHaveBeenCalledWith(mockToken);
    });

    it('should handle no session token gracefully', () => {
      (safeStorage.getItem as any).mockReturnValue(null);
      (getSessionCookie as any).mockReturnValue(null);
      
      const wrapper = ({ children }: any) => (
        <AuthProvider>{children}</AuthProvider>
      );
      
      const { result } = renderHook(() => useAuth(), { wrapper });
      
      expect(result.current.sessionToken).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.user).toBe(mockUser); // Still queries with undefined token
    });
  });

  describe('sendMagicLink', () => {
    it('should send magic link successfully', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      });
      
      const wrapper = ({ children }: any) => (
        <AuthProvider>{children}</AuthProvider>
      );
      
      const { result } = renderHook(() => useAuth(), { wrapper });
      
      let response: any;
      await act(async () => {
        response = await result.current.sendMagicLink('test@example.com');
      });
      
      expect(global.fetch).toHaveBeenCalledWith('/api/auth/send-magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'test@example.com' }),
      });
      
      expect(response).toEqual({ success: true });
      expect(toast.success).toHaveBeenCalledWith('Check your email for the magic link!');
    });

    it('should handle send magic link failure', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: false,
        json: async () => ({ error: 'Email not found' }),
      });
      
      const wrapper = ({ children }: any) => (
        <AuthProvider>{children}</AuthProvider>
      );
      
      const { result } = renderHook(() => useAuth(), { wrapper });
      
      let response: any;
      await act(async () => {
        response = await result.current.sendMagicLink('invalid@example.com');
      });
      
      expect(response.success).toBe(false);
      expect(response.error).toBeDefined();
      expect(toast.error).toHaveBeenCalledWith('Failed to send magic link. Please try again.');
    });

    it('should handle network errors gracefully', async () => {
      (global.fetch as any).mockRejectedValue(new Error('Network error'));
      
      const wrapper = ({ children }: any) => (
        <AuthProvider>{children}</AuthProvider>
      );
      
      const { result } = renderHook(() => useAuth(), { wrapper });
      
      let response: any;
      await act(async () => {
        response = await result.current.sendMagicLink('test@example.com');
      });
      
      expect(response.success).toBe(false);
      expect(response.error).toBeInstanceOf(Error);
      expect(toast.error).toHaveBeenCalledWith('Failed to send magic link. Please try again.');
    });
  });

  describe('verifyMagicLink', () => {
    it('should verify magic link and set session', async () => {
      const mockSession = { 
        sessionToken: 'new-session-token',
        user: mockUser,
      };
      
      mockVerifyMagicLink.mockResolvedValue(mockSession);
      
      const wrapper = ({ children }: any) => (
        <AuthProvider>{children}</AuthProvider>
      );
      
      const { result } = renderHook(() => useAuth(), { wrapper });
      
      let response: any;
      await act(async () => {
        response = await result.current.verifyMagicLink('magic-token-123');
      });
      
      expect(mockVerifyMagicLink).toHaveBeenCalledWith({ token: 'magic-token-123' });
      
      await waitFor(() => {
        expect(result.current.sessionToken).toBe('new-session-token');
      });
      
      expect(safeStorage.setItem).toHaveBeenCalledWith('scry_session_token', 'new-session-token');
      expect(setClientSessionCookie).toHaveBeenCalledWith('new-session-token');
      expect(toast.success).toHaveBeenCalledWith('Successfully signed in!');
      expect(mockRouter.push).toHaveBeenCalledWith('/');
      expect(response).toEqual({ success: true });
    });

    it('should handle verification failure', async () => {
      mockVerifyMagicLink.mockRejectedValue(new Error('Invalid token'));
      
      const wrapper = ({ children }: any) => (
        <AuthProvider>{children}</AuthProvider>
      );
      
      const { result } = renderHook(() => useAuth(), { wrapper });
      
      let response: any;
      await act(async () => {
        response = await result.current.verifyMagicLink('invalid-token');
      });
      
      expect(response.success).toBe(false);
      expect(response.error).toBeDefined();
      expect(toast.error).toHaveBeenCalledWith('Failed to verify magic link. It may be expired.');
    });
  });

  describe('signOut', () => {
    it('should sign out user and clear session', async () => {
      mockSignOut.mockResolvedValue(undefined);
      
      // Set initial session
      (safeStorage.getItem as any).mockReturnValue('existing-token');
      
      const wrapper = ({ children }: any) => (
        <AuthProvider>{children}</AuthProvider>
      );
      
      const { result } = renderHook(() => useAuth(), { wrapper });
      
      // Verify initial state
      expect(result.current.sessionToken).toBe('existing-token');
      
      await act(async () => {
        await result.current.signOut();
      });
      
      expect(mockSignOut).toHaveBeenCalledWith({ sessionToken: 'existing-token' });
      
      await waitFor(() => {
        expect(result.current.sessionToken).toBeNull();
      });
      
      expect(safeStorage.removeItem).toHaveBeenCalledWith('scry_session_token');
      expect(removeClientSessionCookie).toHaveBeenCalled();
      expect(mockRouter.push).toHaveBeenCalledWith('/');
      expect(toast.success).toHaveBeenCalledWith('Successfully signed out');
    });

    it('should handle sign out errors gracefully', async () => {
      mockSignOut.mockRejectedValue(new Error('Sign out failed'));
      
      const wrapper = ({ children }: any) => (
        <AuthProvider>{children}</AuthProvider>
      );
      
      const { result } = renderHook(() => useAuth(), { wrapper });
      
      await act(async () => {
        await result.current.signOut();
      });
      
      expect(toast.error).toHaveBeenCalledWith('Failed to sign out. Please try again.');
    });
  });

  describe('useAuth hook', () => {
    it('should throw error when used outside provider', () => {
      // Suppress console.error for this test
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      expect(() => {
        renderHook(() => useAuth());
      }).toThrow('useAuth must be used within an AuthProvider');
      
      consoleError.mockRestore();
    });

    it('should provide authentication state', () => {
      const wrapper = ({ children }: any) => (
        <AuthProvider>{children}</AuthProvider>
      );
      
      const { result } = renderHook(() => useAuth(), { wrapper });
      
      expect(result.current).toMatchObject({
        user: mockUser,
        isLoading: false,
        isAuthenticated: true,
        sessionToken: expect.any(String),
        sendMagicLink: expect.any(Function),
        verifyMagicLink: expect.any(Function),
        signOut: expect.any(Function),
        updateProfile: expect.any(Function),
        deleteAccount: expect.any(Function),
      });
    });
  });
});