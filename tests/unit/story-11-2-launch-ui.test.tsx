import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useParams } from 'next/navigation';
import LobbyPage from '@/app/game/[id]/page';
import { useGameStore, useRealTimeGamePolling } from '@/lib/store/game-store';
import { useLocalUser } from '@/hooks/use-local-user';
import { useAuth } from '@/hooks/use-auth';

// Mock dependencies
vi.mock('next/navigation', () => ({
  useParams: vi.fn(),
}));

vi.mock('@/lib/store/game-store', () => ({
  useGameStore: vi.fn(),
  useRealTimeGamePolling: vi.fn(),
}));

vi.mock('@/hooks/use-local-user', () => ({
  useLocalUser: vi.fn(),
}));

vi.mock('@/hooks/use-auth', () => ({
  useAuth: vi.fn(),
}));

describe('Task 3: Restrict Game Launch to Admin - UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Subtask 3.1: Hide Launch Game button for non-admin players', () => {
    it('should show launch button for admin player', () => {
      // Mock params
      vi.mocked(useParams).mockReturnValue({ id: 'TEST123' });

      // Mock user store
      const mockGameStore = {
        gameState: {
          id: 'TEST123',
          status: 'LOBBY',
          players: [
            { id: 'admin-user-id', name: 'Admin', role: 'ADMIN', isAlive: true }
          ],
          createdAt: Date.now(),
          creatorId: 'admin-user-id',
        },
        isLoading: false,
        isLaunching: false,
        error: null,
        errorCode: null,
        launchError: null,
        selectedRole: null,
        fetchGame: vi.fn(),
        launch: vi.fn(),
      };

      vi.mocked(useGameStore).mockReturnValue(mockGameStore);
      vi.mocked(useLocalUser).mockReturnValue({ userId: 'admin-user-id' });
      vi.mocked(useAuth).mockReturnValue({
        authState: {
          session: null,
          isLoading: false,
          isAdmin: false,
          isAuthenticated: false,
        },
        refreshAuth: vi.fn(),
        setAnonymousSession: vi.fn(),
        clearAnonymousSession: vi.fn(),
      });
      vi.mocked(useRealTimeGamePolling).mockReturnValue({
        gameState: mockGameStore.gameState,
        isConnected: true,
        playerCount: 1,
        isGameInProgress: false,
        newPlayers: [],
      });

      render(<LobbyPage />);

      // Admin should see the launch button
      expect(screen.getByRole('button', { name: /lancer la partie/i })).toBeInTheDocument();
    });

    it('should hide launch button for regular player', () => {
      // Mock params
      vi.mocked(useParams).mockReturnValue({ id: 'TEST123' });

      // Mock user store
      const mockGameStore = {
        gameState: {
          id: 'TEST123',
          status: 'LOBBY',
          players: [
            { id: 'admin-user-id', name: 'Admin', role: 'ADMIN', isAlive: true },
            { id: 'player-user-id', name: 'Player', isAlive: true }
          ],
          createdAt: Date.now(),
          creatorId: 'admin-user-id',
        },
        isLoading: false,
        isLaunching: false,
        error: null,
        errorCode: null,
        launchError: null,
        selectedRole: null,
        fetchGame: vi.fn(),
        launch: vi.fn(),
      };

      vi.mocked(useGameStore).mockReturnValue(mockGameStore);
      vi.mocked(useLocalUser).mockReturnValue({ userId: 'player-user-id' });
      vi.mocked(useAuth).mockReturnValue({
        authState: {
          session: null,
          isLoading: false,
          isAdmin: false,
          isAuthenticated: false,
        },
        refreshAuth: vi.fn(),
        setAnonymousSession: vi.fn(),
        clearAnonymousSession: vi.fn(),
      });
      vi.mocked(useRealTimeGamePolling).mockReturnValue({
        gameState: mockGameStore.gameState,
        isConnected: true,
        playerCount: 2,
        isGameInProgress: false,
        newPlayers: [],
      });

      render(<LobbyPage />);

      // Regular player should not see an enabled launch button
      const launchButton = screen.queryByRole('button', { name: /lancer la partie/i });
      expect(launchButton).toBeInTheDocument();
      expect(launchButton).toBeDisabled();
    });

    it('should show waiting message for non-admin players', () => {
      // Mock params
      vi.mocked(useParams).mockReturnValue({ id: 'TEST123' });

      // Mock user store
      const mockGameStore = {
        gameState: {
          id: 'TEST123',
          status: 'LOBBY',
          players: [
            { id: 'admin-user-id', name: 'Admin', role: 'ADMIN', isAlive: true },
            { id: 'player-user-id', name: 'Player', isAlive: true }
          ],
          createdAt: Date.now(),
          creatorId: 'admin-user-id',
        },
        isLoading: false,
        isLaunching: false,
        error: null,
        errorCode: null,
        launchError: null,
        selectedRole: null,
        fetchGame: vi.fn(),
        launch: vi.fn(),
      };

      vi.mocked(useGameStore).mockReturnValue(mockGameStore);
      vi.mocked(useLocalUser).mockReturnValue({ userId: 'player-user-id' });
      vi.mocked(useAuth).mockReturnValue({
        authState: {
          session: null,
          isLoading: false,
          isAdmin: false,
          isAuthenticated: false,
        },
        refreshAuth: vi.fn(),
        setAnonymousSession: vi.fn(),
        clearAnonymousSession: vi.fn(),
      });
      vi.mocked(useRealTimeGamePolling).mockReturnValue({
        gameState: mockGameStore.gameState,
        isConnected: true,
        playerCount: 2,
        isGameInProgress: false,
        newPlayers: [],
      });

      render(<LobbyPage />);

      // Should show disabled launch button for non-admin players
      const launchButton = screen.getByRole('button', { name: /lancer la partie/i });
      expect(launchButton).toBeInTheDocument();
      expect(launchButton).toBeDisabled();
    });
  });
});
