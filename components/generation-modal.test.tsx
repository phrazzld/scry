import React from 'react';
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

vi.mock('@clerk/nextjs', () => ({
  useUser: vi.fn(() => ({ isSignedIn: true })),
}));

vi.mock('convex/react', () => ({
  useMutation: vi.fn(() => vi.fn()),
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
    it('should display modal title when open', () => {
      render(<GenerationModal open={true} onOpenChange={mockOnOpenChange} />);

      expect(screen.getByText('Generate Questions')).toBeInTheDocument();
    });

    it('should not render content when closed', () => {
      render(<GenerationModal open={false} onOpenChange={mockOnOpenChange} />);

      expect(screen.queryByText('Generate Questions')).not.toBeInTheDocument();
    });

    it('should have prompt input field', () => {
      render(<GenerationModal open={true} onOpenChange={mockOnOpenChange} />);

      const input = screen.getByPlaceholderText('What do you want to learn?');
      expect(input).toBeInTheDocument();
      expect(input.tagName).toBe('INPUT');
    });

    it('should have generate button', () => {
      render(<GenerationModal open={true} onOpenChange={mockOnOpenChange} />);

      expect(screen.getByRole('button', { name: /Generate/i })).toBeInTheDocument();
    });

    it('should disable generate button when prompt is empty', () => {
      render(<GenerationModal open={true} onOpenChange={mockOnOpenChange} />);

      const generateButton = screen.getByRole('button', { name: /Generate/i });
      expect(generateButton).toBeDisabled();
    });
  });

  describe('Context Question', () => {
    it('should show context topic when currentQuestion is provided', () => {
      render(
        <GenerationModal
          open={true}
          onOpenChange={mockOnOpenChange}
          currentQuestion={mockQuestion as any}
        />
      );

      expect(screen.getByText('Context: React')).toBeInTheDocument();
    });

    it('should set default prompt when opened with question', () => {
      render(
        <GenerationModal
          open={true}
          onOpenChange={mockOnOpenChange}
          currentQuestion={mockQuestion as any}
        />
      );

      const input = screen.getByPlaceholderText('What do you want to learn?') as HTMLInputElement;
      expect(input.value).toBe('5 more like this');
    });
  });

  describe('Form Interaction', () => {
    it('should enable generate button when prompt is entered', async () => {
      render(<GenerationModal open={true} onOpenChange={mockOnOpenChange} />);

      const input = screen.getByPlaceholderText('What do you want to learn?');
      const generateButton = screen.getByRole('button', { name: /Generate/i });

      expect(generateButton).toBeDisabled();

      await user.type(input, 'JavaScript closures');

      expect(generateButton).not.toBeDisabled();
    });

    it('should submit form on Enter key', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          questions: [{ question: 'Test', options: [], correctAnswer: 'A' }],
          topic: 'JavaScript closures',
        }),
      });

      render(<GenerationModal open={true} onOpenChange={mockOnOpenChange} />);

      const input = screen.getByPlaceholderText('What do you want to learn?');
      await user.type(input, 'JavaScript closures');
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      });
    });

    it('should clear prompt after successful generation', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          questions: [{ question: 'Test', options: [], correctAnswer: 'A' }],
          topic: 'JavaScript closures',
        }),
      });

      render(<GenerationModal open={true} onOpenChange={mockOnOpenChange} />);

      const input = screen.getByPlaceholderText('What do you want to learn?') as HTMLInputElement;
      await user.type(input, 'JavaScript closures');

      const generateButton = screen.getByRole('button', { name: /Generate/i });
      await user.click(generateButton);

      await waitFor(() => {
        expect(mockOnOpenChange).toHaveBeenCalledWith(false);
      });
    });
  });

  describe('Question Generation', () => {
    it('should not submit with empty prompt', async () => {
      render(<GenerationModal open={true} onOpenChange={mockOnOpenChange} />);

      const form = screen.getByRole('button', { name: /Generate/i }).closest('form')!;
      fireEvent.submit(form);

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should handle successful generation', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          questions: [
            { question: 'Test', options: [], correctAnswer: 'A' },
            { question: 'Test2', options: [], correctAnswer: 'B' }
          ],
          topic: 'JavaScript closures',
        }),
      });

      render(<GenerationModal open={true} onOpenChange={mockOnOpenChange} />);

      const input = screen.getByPlaceholderText('What do you want to learn?');
      await user.type(input, 'JavaScript closures');

      const generateButton = screen.getByRole('button', { name: /Generate/i });
      await user.click(generateButton);

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith('✓ 2 questions generated');
        expect(mockOnOpenChange).toHaveBeenCalledWith(false);
      });
    });

    it('should prepend context when currentQuestion exists', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          questions: [{ question: 'Test', options: [], correctAnswer: 'A' }],
          topic: 'Test prompt',
        }),
      });

      render(
        <GenerationModal
          open={true}
          onOpenChange={mockOnOpenChange}
          currentQuestion={mockQuestion as any}
        />
      );

      const input = screen.getByPlaceholderText('What do you want to learn?') as HTMLInputElement;
      await user.clear(input);
      await user.type(input, 'harder questions');

      const generateButton = screen.getByRole('button', { name: /Generate/i });
      await user.click(generateButton);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.topic).toContain('Based on: What is React?');
    });

    it('should show loading state during generation', async () => {
      mockFetch.mockImplementationOnce(() =>
        new Promise(resolve => setTimeout(() => resolve({
          ok: true,
          json: async () => ({ questions: [], topic: 'Test' })
        }), 100))
      );

      render(<GenerationModal open={true} onOpenChange={mockOnOpenChange} />);

      const input = screen.getByPlaceholderText('What do you want to learn?');
      await user.type(input, 'Test prompt');

      const generateButton = screen.getByRole('button', { name: /Generate/i });
      await user.click(generateButton);

      expect(screen.getByText('Generating...')).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.queryByText('Generating...')).not.toBeInTheDocument();
      });
    });

    it('should handle API errors gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        text: async () => 'Server error',
      });

      render(<GenerationModal open={true} onOpenChange={mockOnOpenChange} />);

      const input = screen.getByPlaceholderText('What do you want to learn?');
      await user.type(input, 'Test prompt');

      const generateButton = screen.getByRole('button', { name: /Generate/i });
      await user.click(generateButton);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Failed to generate questions');
      });

      expect(mockOnOpenChange).not.toHaveBeenCalledWith(false);
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      render(<GenerationModal open={true} onOpenChange={mockOnOpenChange} />);

      const input = screen.getByPlaceholderText('What do you want to learn?');
      await user.type(input, 'Test prompt');

      const generateButton = screen.getByRole('button', { name: /Generate/i });
      await user.click(generateButton);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Failed to generate questions');
      });
    });
  });
});