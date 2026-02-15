import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RefreshButton } from '@/components/admin/refresh-button';

// Mock dependencies
vi.mock('@/lib/store/game-store', () => ({
  useGameStore: vi.fn(),
}));

vi.mock('@/hooks/use-local-user', () => ({
  useLocalUser: vi.fn(),
}));

import { useGameStore } from '@/lib/store/game-store';
import { useLocalUser } from '@/hooks/use-local-user';

describe('RefreshButton', () => {
  const mockRefreshGameData = vi.fn();
  const mockGameStore = {
    refreshGameData: mockRefreshGameData,
    isRefreshing: false,
  };

  const mockLocalUser = {
    userId: 'test-user-id',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useGameStore).mockReturnValue(mockGameStore);
    vi.mocked(useLocalUser).mockReturnValue(mockLocalUser);
  });

  it('should render the refresh button', () => {
    render(<RefreshButton gameId="test-game-id" />);
    
    const button = screen.getByRole('button', { name: /actualiser/i });
    expect(button).toBeDefined();
  });

  it('should call refreshGameData when clicked', async () => {
    render(<RefreshButton gameId="test-game-id" />);
    
    const button = screen.getByRole('button', { name: /actualiser/i });
    fireEvent.click(button);
    
    await waitFor(() => {
      expect(mockRefreshGameData).toHaveBeenCalledWith('test-game-id', 'test-user-id');
    });
  });

  it('should show loading state during fetch', async () => {
    vi.mocked(useGameStore).mockReturnValue({
      ...mockGameStore,
      isRefreshing: true,
    });

    render(<RefreshButton gameId="test-game-id" />);
    
    const button = screen.getByRole('button', { name: /actualisation/i }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.getAttribute('aria-busy')).toBe('true');
  });

  it('should be disabled when no userId is available', () => {
    vi.mocked(useLocalUser).mockReturnValue({
      userId: null,
    });

    render(<RefreshButton gameId="test-game-id" />);
    
    const button = screen.getByRole('button', { name: /actualiser/i }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it('should prevent multiple rapid clicks', async () => {
    render(<RefreshButton gameId="test-game-id" />);
    
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
    render(<RefreshButton gameId="test-game-id" />);
    
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
