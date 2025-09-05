import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useKeyboardShortcuts, useReviewShortcuts } from './use-keyboard-shortcuts';

// Mock react-hotkeys-hook
vi.mock('react-hotkeys-hook', () => ({
  useHotkeys: vi.fn(),
}));

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ 
    push: vi.fn(),
    back: vi.fn(),
  })),
  usePathname: vi.fn(() => '/'),
}));

import { useHotkeys } from 'react-hotkeys-hook';
import { useRouter } from 'next/navigation';

// Define a type-safe callback store
const hotkeyCallbacks: Record<string, Function> = {};

describe('useKeyboardShortcuts', () => {
  let mockHandlers: any;
  
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear callbacks
    Object.keys(hotkeyCallbacks).forEach(key => delete hotkeyCallbacks[key]);
    
    mockHandlers = {
      onHelp: vi.fn(),
      onGenerateQuiz: vi.fn(),
    };
    
    // Mock useHotkeys to capture the callback
    (useHotkeys as any).mockImplementation((keys: string, callback: Function) => {
      // Store callbacks for testing
      hotkeyCallbacks[keys] = callback;
    });
  });

  it('should register help shortcut (? or shift+/)', () => {
    renderHook(() => useKeyboardShortcuts(mockHandlers));
    
    expect(useHotkeys).toHaveBeenCalledWith(
      'shift+/',
      expect.any(Function),
      expect.objectContaining({
        preventDefault: true,
        enableOnFormTags: false,
      })
    );
  });

  it('should register generate quiz shortcut (g)', () => {
    renderHook(() => useKeyboardShortcuts(mockHandlers));
    
    expect(useHotkeys).toHaveBeenCalledWith(
      'g',
      expect.any(Function),
      expect.objectContaining({
        preventDefault: true,
        enableOnFormTags: false,
      })
    );
  });

  it('should register navigation shortcuts (h for home, b for back)', () => {
    renderHook(() => useKeyboardShortcuts(mockHandlers));
    
    // Check home shortcut
    expect(useHotkeys).toHaveBeenCalledWith(
      'h',
      expect.any(Function),
      expect.objectContaining({
        preventDefault: true,
        enableOnFormTags: false,
      })
    );
    
    // Check back shortcut  
    expect(useHotkeys).toHaveBeenCalledWith(
      'b',
      expect.any(Function),
      expect.objectContaining({
        preventDefault: true,
        enableOnFormTags: false,
      })
    );
  });

  it('should call onHelp handler when help shortcut is triggered', () => {
    renderHook(() => useKeyboardShortcuts(mockHandlers));
    
    // Trigger the help shortcut callback
    const helpCallback = hotkeyCallbacks['shift+/'];
    helpCallback();
    
    expect(mockHandlers.onHelp).toHaveBeenCalled();
  });

  it('should call onGenerateQuiz handler when g is pressed', () => {
    renderHook(() => useKeyboardShortcuts(mockHandlers));
    
    // Trigger the generate quiz shortcut
    const generateCallback = hotkeyCallbacks['g'];
    generateCallback();
    
    expect(mockHandlers.onGenerateQuiz).toHaveBeenCalled();
  });

  it('should navigate to home when h is pressed', () => {
    const mockPush = vi.fn();
    (useRouter as any).mockReturnValue({ push: mockPush });
    
    renderHook(() => useKeyboardShortcuts(mockHandlers));
    
    // Trigger home navigation
    const homeCallback = hotkeyCallbacks['h'];
    homeCallback();
    
    expect(mockPush).toHaveBeenCalledWith('/');
  });

  it('should navigate back when b is pressed', () => {
    const mockBack = vi.fn();
    (useRouter as any).mockReturnValue({ back: mockBack });
    
    renderHook(() => useKeyboardShortcuts(mockHandlers));
    
    // Trigger back navigation
    const backCallback = hotkeyCallbacks['b'];
    backCallback();
    
    expect(mockBack).toHaveBeenCalled();
  });
});

// Define a type-safe review callback store
const reviewHotkeyCallbacks: Record<string, { callback: Function; options: any }> = {};

describe('useReviewShortcuts', () => {
  let mockHandlers: any;
  
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear callbacks
    Object.keys(reviewHotkeyCallbacks).forEach(key => delete reviewHotkeyCallbacks[key]);
    
    mockHandlers = {
      onAnswer: vi.fn(),
      onSubmit: vi.fn(),
      onNext: vi.fn(),
      onEdit: vi.fn(),
      onDelete: vi.fn(),
      onToggleFeedback: vi.fn(),
    };
    
    // Mock useHotkeys
    (useHotkeys as any).mockImplementation((keys: string, callback: Function, options: any) => {
      reviewHotkeyCallbacks[keys] = { callback, options };
    });
  });

  it('should register number keys 1-4 for answer selection', () => {
    renderHook(() => useReviewShortcuts({
      ...mockHandlers,
      isAnswering: true,
    }));
    
    ['1', '2', '3', '4'].forEach(key => {
      expect(useHotkeys).toHaveBeenCalledWith(
        key,
        expect.any(Function),
        expect.objectContaining({
          enabled: true,
          preventDefault: true,
        })
      );
    });
  });

  it('should call onAnswer with correct index when number key is pressed', () => {
    renderHook(() => useReviewShortcuts({
      ...mockHandlers,
      isAnswering: true,
    }));
    
    // Press key 1 (index 0)
    const key1Callback = reviewHotkeyCallbacks['1'].callback;
    key1Callback();
    expect(mockHandlers.onAnswer).toHaveBeenCalledWith(0);
    
    // Press key 3 (index 2)
    const key3Callback = reviewHotkeyCallbacks['3'].callback;
    key3Callback();
    expect(mockHandlers.onAnswer).toHaveBeenCalledWith(2);
  });

  it('should disable answer shortcuts when not answering', () => {
    renderHook(() => useReviewShortcuts({
      ...mockHandlers,
      isAnswering: false,
    }));
    
    ['1', '2', '3', '4'].forEach(key => {
      expect(useHotkeys).toHaveBeenCalledWith(
        key,
        expect.any(Function),
        expect.objectContaining({
          enabled: false,
        })
      );
    });
  });

  it('should register Enter key for submit when answering', () => {
    renderHook(() => useReviewShortcuts({
      ...mockHandlers,
      isAnswering: true,
      canSubmit: true,
    }));
    
    expect(useHotkeys).toHaveBeenCalledWith(
      'enter',
      expect.any(Function),
      expect.objectContaining({
        enabled: true,
        preventDefault: true,
        enableOnFormTags: ['INPUT'],
      })
    );
  });

  it('should register Space key for next when showing feedback', () => {
    renderHook(() => useReviewShortcuts({
      ...mockHandlers,
      isShowingFeedback: true,
    }));
    
    expect(useHotkeys).toHaveBeenCalledWith(
      'space',
      expect.any(Function),
      expect.objectContaining({
        enabled: true,
        preventDefault: true,
      })
    );
  });

  it('should call onNext when Space is pressed during feedback', () => {
    renderHook(() => useReviewShortcuts({
      ...mockHandlers,
      isShowingFeedback: true,
    }));
    
    const spaceCallback = reviewHotkeyCallbacks['space'].callback;
    spaceCallback();
    
    expect(mockHandlers.onNext).toHaveBeenCalled();
  });

  it('should register edit shortcut (e) when editable', () => {
    renderHook(() => useReviewShortcuts({
      ...mockHandlers,
      canEdit: true,
    }));
    
    expect(useHotkeys).toHaveBeenCalledWith(
      'e',
      expect.any(Function),
      expect.objectContaining({
        enabled: true,
        preventDefault: true,
      })
    );
  });

  it('should register delete shortcut (d or Delete) when deletable', () => {
    renderHook(() => useReviewShortcuts({
      ...mockHandlers,
      canDelete: true,
    }));
    
    expect(useHotkeys).toHaveBeenCalledWith(
      'd',
      expect.any(Function),
      expect.objectContaining({
        enabled: true,
        preventDefault: true,
      })
    );
    
    expect(useHotkeys).toHaveBeenCalledWith(
      'delete',
      expect.any(Function),
      expect.objectContaining({
        enabled: true,
        preventDefault: true,
      })
    );
  });

  it('should register toggle feedback shortcut (f)', () => {
    renderHook(() => useReviewShortcuts({
      ...mockHandlers,
    }));
    
    expect(useHotkeys).toHaveBeenCalledWith(
      'f',
      expect.any(Function),
      expect.objectContaining({
        preventDefault: true,
      })
    );
  });

  it('should handle conditional enabling of shortcuts', () => {
    const { rerender } = renderHook(
      (props) => useReviewShortcuts(props),
      {
        initialProps: {
          ...mockHandlers,
          isAnswering: true,
          canSubmit: false,
        },
      }
    );
    
    // Submit should be disabled initially
    let enterOptions = reviewHotkeyCallbacks['enter'].options;
    expect(enterOptions.enabled).toBe(false);
    
    // Re-render with canSubmit true
    rerender({
      ...mockHandlers,
      isAnswering: true,
      canSubmit: true,
    });
    
    // Submit should now be enabled
    enterOptions = reviewHotkeyCallbacks['enter'].options;
    expect(enterOptions.enabled).toBe(true);
  });
});