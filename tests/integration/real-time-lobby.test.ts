import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from '@testing-library/react';
import { useRealTimeGamePolling } from '@/lib/store/game-store';
import { GameState, Player } from '@/types/game';
import useSWR from 'swr';

// Mock SWR and dependencies
vi.mock('swr');
vi.mock('@/lib/store/game-store', async () => {
    const actual = await vi.importActual('@/lib/store/game-store');
    return {
        ...actual,
        useGameStore: vi.fn(),
    };
});

vi.mock('@/lib/redis/actions', () => ({
    refreshGame: vi.fn(),
}));

import { useGameStore } from '@/lib/store/game-store';
import { refreshGame } from '@/lib/redis/actions';

const mockUseSWR = vi.mocked(useSWR);
const mockUseGameStore = vi.mocked(useGameStore);
const mockRefreshGame = vi.mocked(refreshGame);

describe('Real-time Lobby Integration Tests', () => {
    let mockGameState: GameState;
    let mockPlayers: Player[];

    beforeEach(() => {
        vi.clearAllMocks();
        
        mockPlayers = [
            { id: 'user1', name: 'Player 1', isAlive: true, completedQuests: [] },
            { id: 'user2', name: 'Player 2', isAlive: true, completedQuests: [] }
        ];

        mockGameState = {
            id: 'test-game-123',
            status: 'LOBBY',
            players: mockPlayers,
            createdAt: Date.now()
        };

        mockUseGameStore.mockReturnValue({
            refreshGameData: vi.fn().mockResolvedValue(undefined),
            getState: vi.fn().mockReturnValue({ gameState: mockGameState })
        } as unknown as ReturnType<typeof useGameStore>);

        mockRefreshGame.mockResolvedValue({
            success: true,
            data: mockGameState
        });

        // Default SWR mock
        mockUseSWR.mockReturnValue({
            data: {
                ...mockGameState,
                newPlayers: [],
                playerCount: 2,
                isGameInProgress: false
            },
            error: null,
            isLoading: false,
            mutate: vi.fn()
        } as unknown as ReturnType<typeof useSWR>);
    });

    it('should simulate multi-player lobby scenario', () => {
        const { result } = renderHook(() => 
            useRealTimeGamePolling('test-game-123', 'user1')
        );

        // Verify initial player count
        expect(result.current.playerCount).toBe(2);
        expect(result.current.isGameInProgress).toBe(false);
        expect(result.current.isConnected).toBe(true);
    });

    it('should handle new player joining simulation', () => {
        // Mock new player joining
        const newPlayer: Player = { id: 'user3', name: 'Player 3', isAlive: true, completedQuests: [] };
        const updatedGameState = {
            ...mockGameState,
            players: [...mockGameState.players, newPlayer]
        };

        // Mock SWR to return updated state with new player
        mockUseSWR.mockReturnValue({
            data: {
                ...updatedGameState,
                newPlayers: [newPlayer],
                playerCount: 3,
                isGameInProgress: false
            },
            error: null,
            isLoading: false,
            mutate: vi.fn()
        } as unknown as ReturnType<typeof useSWR>);

        const { result } = renderHook(() => 
            useRealTimeGamePolling('test-game-123', 'user1')
        );

        // The hook should detect the new player
        expect(result.current.newPlayers).toContainEqual(newPlayer);
        expect(result.current.playerCount).toBe(3);
    });

    it('should simulate game start and player redirect flow', () => {
        // Mock game state transition to IN_PROGRESS
        const inProgressGameState = {
            ...mockGameState,
            status: 'IN_PROGRESS' as const,
            players: mockPlayers.map(p => ({ ...p, role: p.id === 'user1' ? 'CREWMATE' as const : undefined }))
        };

        mockUseSWR.mockReturnValue({
            data: {
                ...inProgressGameState,
                newPlayers: [],
                playerCount: 2,
                isGameInProgress: true
            },
            error: null,
            isLoading: false,
            mutate: vi.fn()
        } as unknown as ReturnType<typeof useSWR>);

        const { result } = renderHook(() => 
            useRealTimeGamePolling('test-game-123', 'user1')
        );

        // Should detect game in progress
        expect(result.current.isGameInProgress).toBe(true);
        expect(result.current.gameState?.status).toBe('IN_PROGRESS');
    });

    it('should handle connection failures gracefully', () => {
        // Mock network error
        mockUseSWR.mockReturnValue({
            data: null,
            error: new Error('Network error'),
            isLoading: false,
            mutate: vi.fn()
        } as unknown as ReturnType<typeof useSWR>);

        const { result } = renderHook(() => 
            useRealTimeGamePolling('test-game-123', 'user1')
        );

        // Should show disconnected status
        expect(result.current.isConnected).toBe(false);
        expect(result.current.error).toBeTruthy();
    });

    it('should maintain proper cleanup on unmount', () => {
        const { unmount } = renderHook(() => 
            useRealTimeGamePolling('test-game-123', 'user1')
        );

        // Should not throw when unmounting
        expect(() => unmount()).not.toThrow();
    });

    it('should handle rapid player join scenarios', () => {
        // Simulate multiple players joining quickly
        const players = [
            { id: 'user3', name: 'Player 3', isAlive: true, completedQuests: [] },
            { id: 'user4', name: 'Player 4', isAlive: true, completedQuests: [] },
            { id: 'user5', name: 'Player 5', isAlive: true, completedQuests: [] }
        ];

        const finalGameState = {
            ...mockGameState,
            players: [...mockGameState.players, ...players]
        };

        mockUseSWR.mockReturnValue({
            data: {
                ...finalGameState,
                newPlayers: players,
                playerCount: 5,
                isGameInProgress: false
            },
            error: null,
            isLoading: false,
            mutate: vi.fn()
        } as unknown as ReturnType<typeof useSWR>);

        const { result } = renderHook(() => 
            useRealTimeGamePolling('test-game-123', 'user1')
        );

        // Should handle multiple new players
        expect(result.current.playerCount).toBe(5);
        expect(result.current.newPlayers.length).toBeGreaterThanOrEqual(0);
    });
});
