import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getSessionCookie,
  removeClientSessionCookie,
  setClientSessionCookie,
} from './auth-cookies';

// Mock window and document
const documentMock = {
  cookie: '',
};

const windowMock = {
  location: {
    protocol: 'https:',
  },
};

vi.stubGlobal('document', documentMock);
vi.stubGlobal('window', windowMock);

describe('auth-cookies', () => {
  beforeEach(() => {
    documentMock.cookie = '';
    windowMock.location.protocol = 'https:';
  });

  describe('setClientSessionCookie', () => {
    it('should set session cookie with correct attributes in HTTPS', () => {
      setClientSessionCookie('test-token-123');

      expect(documentMock.cookie).toContain('scry_session_token=test-token-123');
      expect(documentMock.cookie).toContain('Path=/');
      expect(documentMock.cookie).toContain('Max-Age=2592000'); // 30 days in seconds
      expect(documentMock.cookie).toContain('SameSite=Lax');
      expect(documentMock.cookie).toContain('Secure');
    });

    it('should set session cookie without Secure flag in HTTP', () => {
      windowMock.location.protocol = 'http:';

      setClientSessionCookie('test-token-456');

      expect(documentMock.cookie).toContain('scry_session_token=test-token-456');
      expect(documentMock.cookie).not.toContain('Secure');
    });
  });

  describe('removeClientSessionCookie', () => {
    it('should remove session cookie by setting Max-Age to 0', () => {
      removeClientSessionCookie();

      expect(documentMock.cookie).toContain('scry_session_token=');
      expect(documentMock.cookie).toContain('Max-Age=0');
      expect(documentMock.cookie).toContain('Path=/');
    });
  });

  describe('getSessionCookie', () => {
    it('should return null when no cookie exists', () => {
      documentMock.cookie = '';

      const result = getSessionCookie();

      expect(result).toBeNull();
    });

    it('should return token value when cookie exists', () => {
      documentMock.cookie = 'scry_session_token=my-token-value';

      const result = getSessionCookie();

      expect(result).toBe('my-token-value');
    });

    it('should handle multiple cookies correctly', () => {
      documentMock.cookie = 'other_cookie=value1; scry_session_token=my-token; another=value2';

      const result = getSessionCookie();

      expect(result).toBe('my-token');
    });

    it('should handle cookies with spaces', () => {
      documentMock.cookie = ' scry_session_token=my-token ; other=value';

      const result = getSessionCookie();

      expect(result).toBe('my-token');
    });
  });
});
