import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RefreshButton } from '@/components/admin/refresh-button';
import { useAuth, AuthProvider } from '@/hooks/use-auth';
import { ReactNode } from 'react';
import { useGameStore } from '@/lib/store/game-store';

// Mock dependencies
vi.mock('@/lib/store/game-store', () => ({
  useGameStore: vi.fn(),
}));

vi.mock('@/hooks/use-auth', () => ({
  useAuth: vi.fn(),
  AuthProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

// Test wrapper component
function CreateWrapper({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}

describe('RefreshButton', () => {
  const mockRefreshGameData = vi.fn();
  const mockGameStore = {
    refreshGameData: mockRefreshGameData,
    isRefreshing: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useGameStore).mockReturnValue(mockGameStore);
  });

  it('should render a refresh button', () => {
    const mockUseAuth = vi.mocked(useAuth);
    mockUseAuth.mockReturnValue({
      authState: {
        session: {
          userId: 'test-user-id',
          username: 'test-user',
          isAuthenticated: false,
          sessionType: 'anonymous',
        },
        isLoading: false,
        isAuthenticated: false,
        isAnonymous: true,
      },
      refreshAuth: vi.fn(),
      setAnonymousSession: vi.fn(),
      clearAnonymousSession: vi.fn(),
    });
    
    render(
      <CreateWrapper>
        <RefreshButton gameId="test-game-id" />
      </CreateWrapper>
    );
    
    const button = screen.getByRole('button', { name: /actualiser/i });
    expect(button).toBeDefined();
  });

  it('should call refreshGameData when clicked', async () => {
    vi.mocked(useAuth).mockReturnValue({
      authState: {
        session: {
          userId: 'test-user-id',
          username: 'test-user',
          isAuthenticated: false,
          sessionType: 'anonymous',
        },
        isLoading: false,
        isAuthenticated: false,
        isAnonymous: true,
      },
      refreshAuth: vi.fn(),
      setAnonymousSession: vi.fn(),
      clearAnonymousSession: vi.fn(),
    });
    
    render(
      <CreateWrapper>
        <RefreshButton gameId="test-game-id" />
      </CreateWrapper>
    );
    
    const button = screen.getByRole('button', { name: /actualiser/i });
    fireEvent.click(button);
    
    await waitFor(() => {
      expect(mockRefreshGameData).toHaveBeenCalledWith('test-game-id', 'test-user-id');
    });
  });

  it('should show loading state during fetch', async () => {
    vi.mocked(useAuth).mockReturnValue({
      authState: {
        session: {
          userId: 'test-user-id',
          username: 'test-user',
          isAuthenticated: false,
          sessionType: 'anonymous',
        },
        isLoading: false,
        isAuthenticated: false,
        isAnonymous: true,
      },
      refreshAuth: vi.fn(),
      setAnonymousSession: vi.fn(),
      clearAnonymousSession: vi.fn(),
    });
    
    vi.mocked(useGameStore).mockReturnValue({
      ...mockGameStore,
      isRefreshing: true,
    });

    render(
      <CreateWrapper>
        <RefreshButton gameId="test-game-id" />
      </CreateWrapper>
    );
    
    const button = screen.getByRole('button', { name: /actualisation/i }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.getAttribute('aria-busy')).toBe('true');
  });

  it('should be disabled when no userId is available', () => {
    vi.mocked(useAuth).mockReturnValue({
      authState: {
        session: null,
        isLoading: false,
        isAuthenticated: false,
        isAnonymous: false,
      },
      refreshAuth: vi.fn(),
      setAnonymousSession: vi.fn(),
      clearAnonymousSession: vi.fn(),
    });

    render(
      <CreateWrapper>
        <RefreshButton gameId="test-game-id" />
      </CreateWrapper>
    );
    
    const button = screen.getByRole('button', { name: /actualiser/i }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it('should prevent multiple rapid clicks', async () => {
    vi.mocked(useAuth).mockReturnValue({
      authState: {
        session: {
          userId: 'test-user-id',
          username: 'test-user',
          isAuthenticated: false,
          sessionType: 'anonymous',
        },
        isLoading: false,
        isAuthenticated: false,
        isAnonymous: true,
      },
      refreshAuth: vi.fn(),
      setAnonymousSession: vi.fn(),
      clearAnonymousSession: vi.fn(),
    });
    
    render(
      <CreateWrapper>
        <RefreshButton gameId="test-game-id" />
      </CreateWrapper>
    );
    
    const button = screen.getByRole('button', { name: /actualiser/i });
    
    // Click multiple times rapidly
    fireEvent.click(button);
    fireEvent.click(button);
    fireEvent.click(button);
    
    await waitFor(() => {
      // Should only call refreshGameData once due to debouncing/loading state
      expect(mockRefreshGameData).toHaveBeenCalledTimes(1);
    });
  });

  it('should debounce clicks within 2 seconds', async () => {
    vi.mocked(useAuth).mockReturnValue({
      authState: {
        session: {
          userId: 'test-user-id',
          username: 'test-user',
          isAuthenticated: false,
          sessionType: 'anonymous',
        },
        isLoading: false,
        isAuthenticated: false,
        isAnonymous: true,
      },
      refreshAuth: vi.fn(),
      setAnonymousSession: vi.fn(),
      clearAnonymousSession: vi.fn(),
    });
    
    render(
      <CreateWrapper>
        <RefreshButton gameId="test-game-id" />
      </CreateWrapper>
    );
    
    const button = screen.getByRole('button', { name: /actualiser/i });
    
    // First click
    fireEvent.click(button);
    
    // Wait a bit then click again (should be debounced)
    await new Promise(resolve => setTimeout(resolve, 100));
    fireEvent.click(button);
    
    await waitFor(() => {
      // Should still only call once due to debouncing
      expect(mockRefreshGameData).toHaveBeenCalledTimes(1);
    });
  });
});
