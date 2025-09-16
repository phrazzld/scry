import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GenerationModal } from './generation-modal';
import { toast } from 'sonner';

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('GenerationModal', () => {
  let mockOnOpenChange: any;
  const user = userEvent.setup();
  const mockQuestion = {
    _id: 'q1',
    question: 'What is React?',
    correctAnswer: 'A JavaScript library',
    options: ['A JavaScript library', 'A framework', 'A database', 'An OS'],
    topic: 'React',
    difficulty: 'easy' as const,
  };
  
  beforeEach(() => {
    vi.clearAllMocks();
    mockOnOpenChange = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Initial State', () => {
    it('should display modal title and description when open', () => {
      render(<GenerationModal open={true} onOpenChange={mockOnOpenChange} />);
      
      expect(screen.getByText('Generate Questions')).toBeInTheDocument();
      expect(screen.getByText('Create new questions to expand your learning material')).toBeInTheDocument();
    });

    it('should not render content when closed', () => {
      render(<GenerationModal open={false} onOpenChange={mockOnOpenChange} />);
      
      expect(screen.queryByText('Generate Questions')).not.toBeInTheDocument();
    });

    it('should have prompt textarea', () => {
      render(<GenerationModal open={true} onOpenChange={mockOnOpenChange} />);
      
      const textarea = screen.getByPlaceholderText(/React hooks/);
      expect(textarea).toBeInTheDocument();
    });

    it('should have generate and cancel buttons', () => {
      render(<GenerationModal open={true} onOpenChange={mockOnOpenChange} />);
      
      expect(screen.getByRole('button', { name: /Generate Questions/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Cancel/i })).toBeInTheDocument();
    });

    it('should disable generate button when prompt is empty', () => {
      render(<GenerationModal open={true} onOpenChange={mockOnOpenChange} />);
      
      const generateButton = screen.getByRole('button', { name: /Generate Questions/i });
      expect(generateButton).toBeDisabled();
    });
  });

  describe('Context Question', () => {
    it('should show context checkbox when currentQuestion is provided', () => {
      render(
        <GenerationModal 
          open={true} 
          onOpenChange={mockOnOpenChange} 
          currentQuestion={mockQuestion as any}
        />
      );
      
      expect(screen.getByText('Start from current question')).toBeInTheDocument();
      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toBeInTheDocument();
    });

    it('should auto-check context and set default prompt when opened with question', () => {
      render(
        <GenerationModal 
          open={true} 
          onOpenChange={mockOnOpenChange} 
          currentQuestion={mockQuestion as any}
        />
      );
      
      const checkbox = screen.getByRole('checkbox') as HTMLInputElement;
      expect(checkbox.checked).toBe(true);
      
      const textarea = screen.getByDisplayValue('Generate 5 similar questions');
      expect(textarea).toBeInTheDocument();
    });

    it('should show current question preview when context is checked', () => {
      render(
        <GenerationModal 
          open={true} 
          onOpenChange={mockOnOpenChange} 
          currentQuestion={mockQuestion as any}
        />
      );
      
      expect(screen.getByText('Current question:')).toBeInTheDocument();
      expect(screen.getByText('What is React?')).toBeInTheDocument();
    });

    it('should toggle context preview when checkbox is clicked', async () => {
      render(
        <GenerationModal 
          open={true} 
          onOpenChange={mockOnOpenChange} 
          currentQuestion={mockQuestion as any}
        />
      );
      
      const checkbox = screen.getByRole('checkbox');
      
      // Initially checked and showing preview
      expect(screen.getByText('Current question:')).toBeInTheDocument();
      
      // Uncheck
      await user.click(checkbox);
      expect(screen.queryByText('Current question:')).not.toBeInTheDocument();
      
      // Check again
      await user.click(checkbox);
      expect(screen.getByText('Current question:')).toBeInTheDocument();
    });

    it('should truncate long question text in preview', () => {
      const longQuestion = {
        ...mockQuestion,
        question: 'This is a very long question that should be truncated after fifty characters to prevent UI overflow',
      };
      
      render(
        <GenerationModal 
          open={true} 
          onOpenChange={mockOnOpenChange} 
          currentQuestion={longQuestion as any}
        />
      );
      
      const preview = screen.getByText(/This is a very long question that should be trunc\.\.\./);
      expect(preview).toBeInTheDocument();
    });
  });

  describe('Form Interaction', () => {
    it('should enable generate button when prompt is entered', async () => {
      render(<GenerationModal open={true} onOpenChange={mockOnOpenChange} />);
      
      const textarea = screen.getByPlaceholderText(/React hooks/);
      const generateButton = screen.getByRole('button', { name: /Generate Questions/i });
      
      expect(generateButton).toBeDisabled();
      
      await user.type(textarea, 'JavaScript closures');
      
      expect(generateButton).not.toBeDisabled();
    });

    it('should clear prompt when modal is closed and reopened', () => {
      const { rerender } = render(<GenerationModal open={true} onOpenChange={mockOnOpenChange} />);
      
      const textarea = screen.getByPlaceholderText(/React hooks/) as HTMLTextAreaElement;
      fireEvent.change(textarea, { target: { value: 'Test prompt' } });
      
      expect(textarea.value).toBe('Test prompt');
      
      // Close modal
      rerender(<GenerationModal open={false} onOpenChange={mockOnOpenChange} />);
      
      // Reopen modal
      rerender(<GenerationModal open={true} onOpenChange={mockOnOpenChange} />);
      
      const newTextarea = screen.getByPlaceholderText(/React hooks/) as HTMLTextAreaElement;
      expect(newTextarea.value).toBe('');
    });

    it('should call onOpenChange when cancel button is clicked', () => {
      render(<GenerationModal open={true} onOpenChange={mockOnOpenChange} />);
      
      const cancelButton = screen.getByRole('button', { name: /Cancel/i });
      fireEvent.click(cancelButton);
      
      expect(mockOnOpenChange).toHaveBeenCalledWith(false);
    });
  });

  describe('Question Generation', () => {
    it('should show error toast when prompt is empty', async () => {
      render(<GenerationModal open={true} onOpenChange={mockOnOpenChange} />);
      
      const form = screen.getByRole('button', { name: /Generate Questions/i }).closest('form')!;
      fireEvent.submit(form);
      
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Please enter a prompt');
      });
      
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should successfully generate questions', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ savedCount: 5, topic: 'JavaScript closures' }),
      });
      
      render(<GenerationModal open={true} onOpenChange={mockOnOpenChange} />);
      
      const textarea = screen.getByPlaceholderText(/React hooks/);
      await user.type(textarea, 'JavaScript closures');
      
      const generateButton = screen.getByRole('button', { name: /Generate Questions/i });
      fireEvent.click(generateButton);
      
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/generate-quiz', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            topic: 'JavaScript closures',
            difficulty: 'medium',
            userContext: expect.objectContaining({
              successRate: expect.any(Number),
              avgTime: expect.any(Number),
              recentTopics: expect.any(Array),
            }),
          }),
        });
      });
      
      expect(toast.success).toHaveBeenCalledWith('✓ 5 questions generated', {
        description: 'JavaScript closures',
        duration: 4000,
      });
      expect(mockOnOpenChange).toHaveBeenCalledWith(false);
    });

    it('should include context in prompt when checkbox is checked', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ savedCount: 0, topic: 'Based on: What is React?. Generate 5 similar questions' }),
      });
      
      render(
        <GenerationModal 
          open={true} 
          onOpenChange={mockOnOpenChange} 
          currentQuestion={mockQuestion as any}
        />
      );
      
      // Context is auto-checked, prompt is auto-filled
      const generateButton = screen.getByRole('button', { name: /Generate Questions/i });
      fireEvent.click(generateButton);
      
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/generate-quiz', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            topic: 'Based on: What is React?. Generate 5 similar questions',
            difficulty: 'medium',
            userContext: expect.any(Object),
          }),
        });
      });
    });

    it('should show loading state while generating', async () => {
      mockFetch.mockImplementationOnce(() => 
        new Promise(resolve => setTimeout(() => resolve({ ok: true, json: async () => ({ savedCount: 1, topic: 'Test prompt' }) }), 100))
      );
      
      render(<GenerationModal open={true} onOpenChange={mockOnOpenChange} />);
      
      const textarea = screen.getByPlaceholderText(/React hooks/);
      await user.type(textarea, 'Test prompt');
      
      const generateButton = screen.getByRole('button', { name: /Generate Questions/i });
      fireEvent.click(generateButton);
      
      expect(screen.getByText('Generating...')).toBeInTheDocument();
      expect(textarea).toBeDisabled();
      expect(screen.getByRole('button', { name: /Cancel/i })).toBeDisabled();
      
      await waitFor(() => {
        expect(screen.queryByText('Generating...')).not.toBeInTheDocument();
      });
    });

    it('should handle generation errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        text: async () => 'Server error',
      });
      
      render(<GenerationModal open={true} onOpenChange={mockOnOpenChange} />);
      
      const textarea = screen.getByPlaceholderText(/React hooks/);
      await user.type(textarea, 'Test prompt');
      
      const generateButton = screen.getByRole('button', { name: /Generate Questions/i });
      fireEvent.click(generateButton);
      
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Failed to generate questions. Please try again.');
      });
      
      expect(mockOnOpenChange).not.toHaveBeenCalledWith(false);
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));
      
      render(<GenerationModal open={true} onOpenChange={mockOnOpenChange} />);
      
      const textarea = screen.getByPlaceholderText(/React hooks/);
      await user.type(textarea, 'Test prompt');
      
      const generateButton = screen.getByRole('button', { name: /Generate Questions/i });
      fireEvent.click(generateButton);
      
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Failed to generate questions. Please try again.');
      });
    });
  });

  describe('Accessibility', () => {
    it('should auto-focus textarea when modal opens', async () => {
      render(<GenerationModal open={true} onOpenChange={mockOnOpenChange} />);
      
      await waitFor(() => {
        const textarea = screen.getByPlaceholderText(/React hooks/);
        expect(document.activeElement).toBe(textarea);
      });
    });
  });
});
