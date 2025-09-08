import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthModal } from './auth-modal';
import { toast } from 'sonner';

// Mock dependencies
vi.mock('@/contexts/auth-context', () => ({
  useAuth: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
  },
}));

import { useAuth } from '@/contexts/auth-context';

describe('AuthModal', () => {
  let mockSendMagicLink: any;
  let mockOnOpenChange: any;
  const user = userEvent.setup();
  
  beforeEach(() => {
    vi.clearAllMocks();
    
    mockSendMagicLink = vi.fn();
    mockOnOpenChange = vi.fn();
    
    (useAuth as any).mockReturnValue({
      sendMagicLink: mockSendMagicLink,
    });
  });

  describe('Initial State', () => {
    it('should display welcome message when open', () => {
      render(<AuthModal open={true} onOpenChange={mockOnOpenChange} />);
      
      expect(screen.getByText('Welcome to Scry')).toBeInTheDocument();
      expect(screen.getByText(/Enter your email to get started/)).toBeInTheDocument();
    });

    it('should not render content when closed', () => {
      render(<AuthModal open={false} onOpenChange={mockOnOpenChange} />);
      
      expect(screen.queryByText('Welcome to Scry')).not.toBeInTheDocument();
    });

    it('should have email input field', () => {
      render(<AuthModal open={true} onOpenChange={mockOnOpenChange} />);
      
      const emailInput = screen.getByPlaceholderText('Enter your email');
      expect(emailInput).toBeInTheDocument();
      expect(emailInput).toHaveAttribute('type', 'email');
    });

    it('should have submit button', () => {
      render(<AuthModal open={true} onOpenChange={mockOnOpenChange} />);
      
      const submitButton = screen.getByRole('button', { name: /Send Magic Link/i });
      expect(submitButton).toBeInTheDocument();
    });
  });

  describe('Email Validation', () => {
    it('should show error for empty email', async () => {
      render(<AuthModal open={true} onOpenChange={mockOnOpenChange} />);
      
      const submitButton = screen.getByRole('button', { name: /Send Magic Link/i });
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByText('Email is required')).toBeInTheDocument();
      });
      
      expect(mockSendMagicLink).not.toHaveBeenCalled();
    });

    it('should show error for invalid email format', async () => {
      render(<AuthModal open={true} onOpenChange={mockOnOpenChange} />);
      
      const emailInput = screen.getByPlaceholderText('Enter your email');
      await user.type(emailInput, 'invalid-email');
      
      const submitButton = screen.getByRole('button', { name: /Send Magic Link/i });
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument();
      });
      
      expect(mockSendMagicLink).not.toHaveBeenCalled();
    });

    it('should accept valid email format', async () => {
      mockSendMagicLink.mockResolvedValue({ success: true });
      
      render(<AuthModal open={true} onOpenChange={mockOnOpenChange} />);
      
      const emailInput = screen.getByPlaceholderText('Enter your email');
      await user.type(emailInput, 'test@example.com');
      
      const submitButton = screen.getByRole('button', { name: /Send Magic Link/i });
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        expect(mockSendMagicLink).toHaveBeenCalledWith('test@example.com');
      });
    });
  });

  describe('Magic Link Sending', () => {
    it('should show loading state while sending', async () => {
      mockSendMagicLink.mockImplementation(() => new Promise(resolve => {
        setTimeout(() => resolve({ success: true }), 100);
      }));
      
      render(<AuthModal open={true} onOpenChange={mockOnOpenChange} />);
      
      const emailInput = screen.getByPlaceholderText('Enter your email');
      await user.type(emailInput, 'test@example.com');
      
      const submitButton = screen.getByRole('button', { name: /Send Magic Link/i });
      fireEvent.click(submitButton);
      
      expect(screen.getByText('Sending magic link...')).toBeInTheDocument();
      expect(submitButton).toBeDisabled();
      
      await waitFor(() => {
        expect(screen.queryByText('Sending magic link...')).not.toBeInTheDocument();
      });
    });

    it('should show success message after sending', async () => {
      mockSendMagicLink.mockResolvedValue({ success: true });
      
      render(<AuthModal open={true} onOpenChange={mockOnOpenChange} />);
      
      const emailInput = screen.getByPlaceholderText('Enter your email');
      await user.type(emailInput, 'test@example.com');
      
      const submitButton = screen.getByRole('button', { name: /Send Magic Link/i });
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByText('Check your email')).toBeInTheDocument();
        expect(screen.getByText('Email sent!')).toBeInTheDocument();
        expect(screen.getByText(/We've sent a magic link to/)).toBeInTheDocument();
        expect(screen.getByText('test@example.com')).toBeInTheDocument();
      });
    });

    it('should allow trying another email after success', async () => {
      mockSendMagicLink.mockResolvedValue({ success: true });
      
      render(<AuthModal open={true} onOpenChange={mockOnOpenChange} />);
      
      const emailInput = screen.getByPlaceholderText('Enter your email');
      await user.type(emailInput, 'test@example.com');
      
      const submitButton = screen.getByRole('button', { name: /Send Magic Link/i });
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByText('Check your email')).toBeInTheDocument();
      });
      
      const tryAnotherButton = screen.getByRole('button', { name: /Try another email/i });
      fireEvent.click(tryAnotherButton);
      
      expect(screen.getByText('Welcome to Scry')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Enter your email')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should show inline error for email-specific errors', async () => {
      mockSendMagicLink.mockResolvedValue({ 
        success: false, 
        error: { message: 'Email is already in use' }
      });
      
      render(<AuthModal open={true} onOpenChange={mockOnOpenChange} />);
      
      const emailInput = screen.getByPlaceholderText('Enter your email');
      await user.type(emailInput, 'test@example.com');
      
      const submitButton = screen.getByRole('button', { name: /Send Magic Link/i });
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByText('Email is already in use')).toBeInTheDocument();
      });
      
      // Should not show success state
      expect(screen.queryByText('Check your email')).not.toBeInTheDocument();
    });

    it('should show toast for general errors', async () => {
      mockSendMagicLink.mockResolvedValue({ 
        success: false, 
        error: { message: 'Server error occurred' }
      });
      
      render(<AuthModal open={true} onOpenChange={mockOnOpenChange} />);
      
      const emailInput = screen.getByPlaceholderText('Enter your email');
      await user.type(emailInput, 'test@example.com');
      
      const submitButton = screen.getByRole('button', { name: /Send Magic Link/i });
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          'Authentication Error',
          expect.objectContaining({
            description: 'Server error occurred'
          })
        );
      });
    });

    it('should show toast for network errors', async () => {
      mockSendMagicLink.mockRejectedValue(new Error('Network error'));
      
      render(<AuthModal open={true} onOpenChange={mockOnOpenChange} />);
      
      const emailInput = screen.getByPlaceholderText('Enter your email');
      await user.type(emailInput, 'test@example.com');
      
      const submitButton = screen.getByRole('button', { name: /Send Magic Link/i });
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          'Something went wrong',
          expect.objectContaining({
            description: 'Please check your connection and try again.'
          })
        );
      });
    });
  });

  describe('State Management', () => {
    it('should reset form when modal is closed', async () => {
      mockSendMagicLink.mockResolvedValue({ success: true });
      
      const { rerender } = render(<AuthModal open={true} onOpenChange={mockOnOpenChange} />);
      
      // Fill in email and submit
      const emailInput = screen.getByPlaceholderText('Enter your email');
      await user.type(emailInput, 'test@example.com');
      
      const submitButton = screen.getByRole('button', { name: /Send Magic Link/i });
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByText('Check your email')).toBeInTheDocument();
      });
      
      // Close and reopen modal
      rerender(<AuthModal open={false} onOpenChange={mockOnOpenChange} />);
      rerender(<AuthModal open={true} onOpenChange={mockOnOpenChange} />);
      
      // Should be back to initial state
      expect(screen.getByText('Welcome to Scry')).toBeInTheDocument();
      const newEmailInput = screen.getByPlaceholderText('Enter your email') as HTMLInputElement;
      expect(newEmailInput.value).toBe('');
    });

    it('should disable input and button while loading', async () => {
      mockSendMagicLink.mockImplementation(() => new Promise(resolve => {
        setTimeout(() => resolve({ success: true }), 100);
      }));
      
      render(<AuthModal open={true} onOpenChange={mockOnOpenChange} />);
      
      const emailInput = screen.getByPlaceholderText('Enter your email');
      await user.type(emailInput, 'test@example.com');
      
      const submitButton = screen.getByRole('button', { name: /Send Magic Link/i });
      fireEvent.click(submitButton);
      
      expect(emailInput).toBeDisabled();
      expect(submitButton).toBeDisabled();
      
      await waitFor(() => {
        expect(screen.getByText('Check your email')).toBeInTheDocument();
      });
    });
  });
});