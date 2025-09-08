import { describe, it, expect, beforeEach, vi } from 'vitest'
import { safeStorage } from './storage'

// Mock window and localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key]
    }),
    clear: () => {
      store = {}
    }
  }
})()

// Mock window global
vi.stubGlobal('window', { localStorage: localStorageMock })
vi.stubGlobal('localStorage', localStorageMock)

describe('safeStorage', () => {
  beforeEach(() => {
    // Clear the mock store before each test
    localStorageMock.clear()
    vi.clearAllMocks()
  })

  describe('getItem', () => {
    it('should return null when item does not exist', () => {
      const result = safeStorage.getItem('non-existent')
      
      expect(result).toBeNull()
      expect(localStorageMock.getItem).toHaveBeenCalledWith('non-existent')
    })

    it('should return stored value when item exists', () => {
      localStorageMock.setItem('test-key', 'test-value')
      
      const result = safeStorage.getItem('test-key')
      
      expect(result).toBe('test-value')
      expect(localStorageMock.getItem).toHaveBeenCalledWith('test-key')
    })

    it('should handle localStorage errors gracefully', () => {
      localStorageMock.getItem.mockImplementationOnce(() => {
        throw new Error('Storage access failed')
      })
      
      const result = safeStorage.getItem('test-key')
      
      expect(result).toBeNull()
    })
  })

  describe('setItem', () => {
    it('should store value and return true on success', () => {
      const result = safeStorage.setItem('new-key', 'new-value')
      
      expect(result).toBe(true)
      expect(localStorageMock.setItem).toHaveBeenCalledWith('new-key', 'new-value')
      expect(localStorageMock.getItem('new-key')).toBe('new-value')
    })

    it('should handle localStorage errors gracefully', () => {
      localStorageMock.setItem.mockImplementationOnce(() => {
        throw new Error('Storage write failed')
      })
      
      const result = safeStorage.setItem('test-key', 'test-value')
      
      expect(result).toBe(false)
    })

    it('should overwrite existing values', () => {
      safeStorage.setItem('key', 'value1')
      const result = safeStorage.setItem('key', 'value2')
      
      expect(result).toBe(true)
      expect(localStorageMock.getItem('key')).toBe('value2')
    })
  })

  describe('removeItem', () => {
    it('should remove existing item', () => {
      localStorageMock.setItem('key-to-remove', 'value')
      
      safeStorage.removeItem('key-to-remove')
      
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('key-to-remove')
      expect(localStorageMock.getItem('key-to-remove')).toBeNull()
    })

    it('should handle removing non-existent item', () => {
      // Should not throw
      expect(() => safeStorage.removeItem('non-existent')).not.toThrow()
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('non-existent')
    })

    it('should handle localStorage errors gracefully', () => {
      localStorageMock.removeItem.mockImplementationOnce(() => {
        throw new Error('Storage remove failed')
      })
      
      // Should not throw
      expect(() => safeStorage.removeItem('test-key')).not.toThrow()
    })
  })
})