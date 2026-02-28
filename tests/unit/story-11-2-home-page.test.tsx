import { describe, it, expect, vi, beforeEach, type MockedFunction } from "vitest";
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import Home from '@/app/page';
import { AuthProvider } from '@/hooks/use-auth';

// Mock the dependencies
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
}));

vi.mock('@/lib/utils/short-code', () => ({
  isValidShortCode: vi.fn(),
  normalizeShortCode: vi.fn(),
}));

vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({
    authState: {
      session: null,
      isLoading: false,
      isAuthenticated: false,
      isAnonymous: true,
    },
    refreshAuth: vi.fn(),
    setAnonymousSession: vi.fn(),
    clearAnonymousSession: vi.fn(),
  }),
  AuthProvider: ({ children }: { children: ReactNode }) => children,
}));

describe('Home Page - Story 11.2', () => {
  const mockPush = vi.fn();
  
  beforeEach(() => {
    const mockRouter = {
      push: mockPush,
      back: vi.fn(),
      forward: vi.fn(),
      refresh: vi.fn(),
      replace: vi.fn(),
      prefetch: vi.fn(),
    };
    
    (useRouter as MockedFunction<typeof useRouter>).mockReturnValue(mockRouter);
    vi.clearAllMocks();
  });

  describe('Task 1: Refactor Home Page UI', () => {
    it('should not display Scan button (AC: 1)', () => {
      render(
        <AuthProvider>
          <Home />
        </AuthProvider>
      );
      
      // Scan button should not be present
      expect(screen.queryByTestId('scan-button')).not.toBeInTheDocument();
      expect(screen.queryByText('SCANNER')).not.toBeInTheDocument();
    });

    it('should display only Join a game and Login options (AC: 1)', () => {
      render(
        <AuthProvider>
          <Home />
        </AuthProvider>
      );
      
      // Check for join form elements
      expect(screen.getByPlaceholderText('6-CHAR CODE...')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /join session/i })).toBeInTheDocument();
      
      // Check for login option
      expect(screen.getByRole('button', { name: /login portal/i })).toBeInTheDocument();
      expect(screen.getByText('Organizer')).toBeInTheDocument();
    });

    it('should handle join by code correctly', async () => {
      const { isValidShortCode, normalizeShortCode } = await import('@/lib/utils/short-code');
      vi.mocked(isValidShortCode).mockReturnValue(true);
      vi.mocked(normalizeShortCode).mockReturnValue('ABC123');

      render(
        <AuthProvider>
          <Home />
        </AuthProvider>
      );
      
      const input = screen.getByPlaceholderText('6-CHAR CODE...');
      const submitButton = screen.getByRole('button', { name: /join session/i });

      fireEvent.change(input, { target: { value: 'abc123' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/game/ABC123');
      });
    });

    it('should handle login redirection', () => {
      render(
        <AuthProvider>
          <Home />
        </AuthProvider>
      );
      
      const loginButton = screen.getByRole('button', { name: /login portal/i });
      fireEvent.click(loginButton);

      expect(mockPush).toHaveBeenCalledWith('/login');
    });
  });
});
