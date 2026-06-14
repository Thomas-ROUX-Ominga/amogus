/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from '@testing-library/react';
import { useParams, useRouter } from 'next/navigation';
import LobbyPage from '@/app/game/[id]/page';
import { useGameStore, useRealTimeGamePolling } from '@/lib/store/game-store';
import { useAuth } from '@/hooks/use-auth';
import { GameState } from "@/types/game";

// Mock dependencies
vi.mock('next/navigation', () => ({
  useParams: vi.fn(),
  useRouter: vi.fn(),
}));

vi.mock('@/lib/store/game-store', () => ({
  useGameStore: vi.fn(),
  useRealTimeGamePolling: vi.fn(),
}));

vi.mock('@/hooks/use-auth', () => ({
  useAuth: vi.fn(),
}));

describe('Task 3: Restrict Game Launch to Admin - UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useRouter).mockReturnValue({
      push: vi.fn(),
    } as unknown as ReturnType<typeof useRouter>);
  });

  it('should show launch button for admin player', () => {
    vi.mocked(useParams).mockReturnValue({ id: 'TEST123' });
    vi.mocked(useAuth).mockReturnValue({
      authState: {
        session: { userId: 'admin-user-id', username: 'admin', role: 'organizer' } as any,
        isLoading: false,
        isAuthenticated: true,
        isAnonymous: false,
      },
      refreshAuth: vi.fn(),
      setAnonymousSession: vi.fn(),
      clearAnonymousSession: vi.fn(),
    } as ReturnType<typeof useAuth>);

    const mockGameState = {
      id: 'TEST123',
      status: 'LOBBY' as const,
      players: [
        { id: 'admin-user-id', name: 'Admin', role: 'CREWMATE' as const, isAlive: true }
      ],
      createdAt: Date.now(),
     revision: 1,
     updatedAt: Date.now(),
      creatorId: 'admin-user-id',
      newPlayers: [],
      playerCount: 1,
      isGameInProgress: false,
    };

    vi.mocked(useGameStore).mockReturnValue({
      gameState: mockGameState,
      isLoading: false,
      isLaunching: false,
      fatalError: null,
      fatalErrorCode: null,
      error: null,
      errorCode: null,
      launchError: null,
      selectedRole: null,
      fetchGame: vi.fn(),
      launch: vi.fn(),
      reset: vi.fn(),
    } as any);

    vi.mocked(useRealTimeGamePolling).mockReturnValue({
      gameState: mockGameState,
      isConnected: true,
      syncStatus: "connected",
      playerCount: 1,
      isGameInProgress: false,
      isGameFinished: false,
      newPlayers: [],
      isLoading: false,
      error: null,
      mutate: vi.fn(),
    } as any);

    render(<LobbyPage />);
    expect(screen.getByText(/LANCER LA PARTIE/i)).toBeInTheDocument();
  });

  it('should hide launch button for regular player', () => {
    vi.mocked(useParams).mockReturnValue({ id: 'TEST123' });
    vi.mocked(useAuth).mockReturnValue({
      authState: {
        session: { 
          userId: 'player-user-id', 
          username: 'Player',
          isAuthenticated: false,
          sessionType: 'anonymous'
        } as any,
        isLoading: false,
        isAuthenticated: false,
        isAnonymous: true,
      },
      refreshAuth: vi.fn(),
      setAnonymousSession: vi.fn(),
      clearAnonymousSession: vi.fn(),
    } as ReturnType<typeof useAuth>);

    const mockGameState = {
      id: 'TEST123',
      status: 'LOBBY' as const,
      players: [
        { id: 'admin-user-id', name: 'Admin', isAlive: true },
        { id: 'player-user-id', name: 'Player', isAlive: true }
      ],
      createdAt: Date.now(),
     revision: 1,
     updatedAt: Date.now(),
      creatorId: 'admin-user-id',
      newPlayers: [],
      playerCount: 2,
      isGameInProgress: false,
    };

    vi.mocked(useGameStore).mockReturnValue({
      gameState: mockGameState,
      isLoading: false,
      isLaunching: false,
      fatalError: null,
      fatalErrorCode: null,
      error: null,
      errorCode: null,
      launchError: null,
      selectedRole: null,
      fetchGame: vi.fn(),
      launch: vi.fn(),
      reset: vi.fn(),
    } as any);

    vi.mocked(useRealTimeGamePolling).mockReturnValue({
      gameState: mockGameState,
      isConnected: true,
      syncStatus: "connected",
      playerCount: 2,
      isGameInProgress: false,
      isGameFinished: false,
      newPlayers: [],
      isLoading: false,
      error: null,
      mutate: vi.fn(),
    } as any);

    render(<LobbyPage />);

    // Regular player should not see a launch button
    expect(screen.queryByText(/LANCER LA MISSION/i)).not.toBeInTheDocument();
  });

  it("should show role reveal for host already in lobby when game starts", async () => {
    vi.mocked(useParams).mockReturnValue({ id: "TEST123" });
    vi.mocked(useAuth).mockReturnValue({
      authState: {
        session: { userId: "admin-user-id", username: "admin", role: "organizer" } as any,
        isLoading: false,
        isAuthenticated: true,
        isAnonymous: false,
      },
      refreshAuth: vi.fn(),
      setAnonymousSession: vi.fn(),
      clearAnonymousSession: vi.fn(),
    } as ReturnType<typeof useAuth>);

    let mockGameState: GameState = {
      id: "TEST123",
      status: "LOBBY",
      players: [{ id: "admin-user-id", name: "Admin", isAlive: true }],
      createdAt: Date.now(),
      revision: 1,
      updatedAt: Date.now(),
      creatorId: "admin-user-id",
    };

    vi.mocked(useGameStore).mockImplementation(() => ({
      gameState: mockGameState,
      isLoading: false,
      isJoining: false,
      isLaunching: false,
      fatalError: null,
      fatalErrorCode: null,
      error: null,
      errorCode: null,
      launchError: null,
      selectedRole: null,
      fetchGame: vi.fn(),
      launch: vi.fn(),
      reset: vi.fn(),
    } as any));

    vi.mocked(useRealTimeGamePolling).mockImplementation(() => ({
      isConnected: true,
      syncStatus: "connected",
      playerCount: mockGameState.players.length,
      isGameInProgress: mockGameState.status === "IN_PROGRESS",
      isGameFinished: false,
      newPlayers: [],
      isLoading: false,
      error: null,
      mutate: vi.fn(),
    } as any));

    const { rerender } = render(<LobbyPage />);

    mockGameState = {
      ...mockGameState,
      status: "IN_PROGRESS",
      revision: 2,
      updatedAt: Date.now(),
      players: [{ id: "admin-user-id", name: "Admin", isAlive: true, role: "IMPOSTOR" as const }],
    };
    rerender(<LobbyPage />);

    await waitFor(() => {
      expect(screen.getByText("Rôle attribué")).toBeInTheDocument();
      expect(screen.getByText("IMPOSTEUR")).toBeInTheDocument();
    });
  });
});
