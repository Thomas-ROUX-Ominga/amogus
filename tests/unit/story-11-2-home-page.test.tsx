import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import Home from '@/app/page';

// Mock the dependencies
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
}));

vi.mock('@/lib/utils/short-code', () => ({
  isValidShortCode: vi.fn(),
  normalizeShortCode: vi.fn(),
}));

describe('Home Page - Story 11.2', () => {
  const mockPush = vi.fn();
  
  beforeEach(() => {
    (useRouter as vi.MockedFunction<typeof useRouter>).mockReturnValue({
      push: mockPush,
      back: vi.fn(),
      forward: vi.fn(),
      refresh: vi.fn(),
      replace: vi.fn(),
      prefetch: vi.fn(),
    } as ReturnType<typeof useRouter>);
    
    vi.clearAllMocks();
  });

  describe('Task 1: Refactor Home Page UI', () => {
    it('should not display Scan button (AC: 1)', () => {
      render(<Home />);
      
      // Scan button should not be present
      expect(screen.queryByTestId('scan-button')).not.toBeInTheDocument();
      expect(screen.queryByText('SCANNER')).not.toBeInTheDocument();
    });

    it('should display only Join a game and Login options (AC: 1)', () => {
      render(<Home />);
      
      // Check for join form elements
      expect(screen.getByPlaceholderText('6-CHAR CODE...')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /join session/i })).toBeInTheDocument();
      
      // Check for login option
      expect(screen.getByRole('button', { name: /access portal/i })).toBeInTheDocument();
      expect(screen.getByText('Organizer')).toBeInTheDocument();
    });

    it('should handle join by code correctly', async () => {
      const { isValidShortCode, normalizeShortCode } = await import('@/lib/utils/short-code');
      vi.mocked(isValidShortCode).mockReturnValue(true);
      vi.mocked(normalizeShortCode).mockReturnValue('ABC123');

      render(<Home />);
      
      const input = screen.getByPlaceholderText('6-CHAR CODE...');
      const submitButton = screen.getByRole('button', { name: /join session/i });

      fireEvent.change(input, { target: { value: 'abc123' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/game/ABC123');
      });
    });

    it('should handle login redirection', () => {
      render(<Home />);
      
      const loginButton = screen.getByRole('button', { name: /access portal/i });
      fireEvent.click(loginButton);

      expect(mockPush).toHaveBeenCalledWith('/login');
    });
  });
});
