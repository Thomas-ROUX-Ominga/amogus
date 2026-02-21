import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from '@testing-library/react';
import { useRealTimeGamePolling } from '@/lib/store/game-store';
import { GameState } from '@/types/game';
import useSWR from 'swr';

// Mock SWR
vi.mock('swr');
vi.mock('@/lib/store/game-store', async () => {
    const actual = await vi.importActual('@/lib/store/game-store');
    return {
        ...actual,
        useGameStore: vi.fn()
    };
});

import { useGameStore } from '@/lib/store/game-store';

const mockUseSWR = vi.mocked(useSWR);
const mockUseGameStore = vi.mocked(useGameStore);

describe('useRealTimeGamePolling', () => {
    const mockRefreshGameData = vi.fn();
    const mockGameState: GameState = {
        id: 'test-game',
        status: 'LOBBY',
        players: [
            { id: 'user1', name: 'Player 1', isAlive: true, completedQuests: [] },
            { id: 'user2', name: 'Player 2', isAlive: true, completedQuests: [] }
        ],
        createdAt: Date.now()
    };

    beforeEach(() => {
        vi.clearAllMocks();
        
        mockUseGameStore.mockReturnValue({
            refreshGameData: mockRefreshGameData,
            getState: vi.fn().mockReturnValue({ gameState: mockGameState })
        } as unknown as ReturnType<typeof useGameStore>);

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

    it('should return initial state when gameId is not provided', () => {
        mockUseSWR.mockReturnValue({
            data: null,
            error: null,
            isLoading: false,
            mutate: vi.fn()
        } as unknown as ReturnType<typeof useSWR>);

        const { result } = renderHook(() => useRealTimeGamePolling('', 'user1'));

        expect(result.current.gameState).toBeNull();
        expect(result.current.error).toBeNull();
        expect(result.current.isLoading).toBe(false);
        expect(result.current.playerCount).toBe(0);
        expect(result.current.isGameInProgress).toBe(false);
        expect(result.current.newPlayers).toEqual([]);
    });

    it('should call SWR with correct key when enabled', () => {
        renderHook(() => useRealTimeGamePolling('test-game', 'user1'));

        expect(mockUseSWR).toHaveBeenCalledWith(
            'game:test-game:poll',
            expect.any(Function),
            {
                refreshInterval: 2000,
                revalidateOnFocus: true,
                revalidateOnReconnect: true,
                errorRetryCount: 3,
                errorRetryInterval: 1000,
            }
        );
    });

    it('should not call SWR when disabled', () => {
        renderHook(() => useRealTimeGamePolling('test-game', 'user1', false));

        expect(mockUseSWR).toHaveBeenCalledWith(
            null,
            expect.any(Function),
            expect.any(Object)
        );
    });

    it('should return connection status when no error and not loading', () => {
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

        const { result } = renderHook(() => useRealTimeGamePolling('test-game'));

        expect(result.current.isConnected).toBe(true);
    });

    it('should return disconnected status when error occurs', () => {
        mockUseSWR.mockReturnValue({
            data: null,
            error: new Error('Network error'),
            isLoading: false,
            mutate: vi.fn()
        } as unknown as ReturnType<typeof useSWR>);

        const { result } = renderHook(() => useRealTimeGamePolling('test-game'));

        expect(result.current.isConnected).toBe(false);
    });

    it('should return disconnected status when loading', () => {
        mockUseSWR.mockReturnValue({
            data: null,
            error: null,
            isLoading: true,
            mutate: vi.fn()
        } as unknown as ReturnType<typeof useSWR>);

        const { result } = renderHook(() => useRealTimeGamePolling('test-game'));

        expect(result.current.isConnected).toBe(false);
    });

    it('should detect new players correctly', async () => {
        const newPlayer = { id: 'user3', name: 'Player 3', isAlive: true, completedQuests: [] };
        const updatedGameState = {
            ...mockGameState,
            players: [...mockGameState.players, newPlayer]
        };

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

        const { result } = renderHook(() => useRealTimeGamePolling('test-game'));

        expect(result.current.newPlayers).toEqual([newPlayer]);
        expect(result.current.playerCount).toBe(3);
    });

    it('should handle empty game state gracefully', () => {
        mockUseSWR.mockReturnValue({
            data: null,
            error: null,
            isLoading: false,
            mutate: vi.fn()
        } as unknown as ReturnType<typeof useSWR>);

        const { result } = renderHook(() => useRealTimeGamePolling('test-game'));

        expect(result.current.playerCount).toBe(0);
        expect(result.current.isGameInProgress).toBe(false);
        expect(result.current.gameState).toBeNull();
        expect(result.current.newPlayers).toEqual([]);
    });

    it('should detect game in progress state', () => {
        const inProgressGameState = {
            ...mockGameState,
            status: 'IN_PROGRESS' as const
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

        const { result } = renderHook(() => useRealTimeGamePolling('test-game'));

        expect(result.current.isGameInProgress).toBe(true);
        expect(result.current.gameState?.status).toBe('IN_PROGRESS');
    });

    it('should have correct SWR configuration', () => {
        renderHook(() => useRealTimeGamePolling('test-game', 'user1'));

        expect(mockUseSWR).toHaveBeenCalledWith(
            'game:test-game:poll',
            expect.any(Function),
            {
                refreshInterval: 2000,
                revalidateOnFocus: true,
                revalidateOnReconnect: true,
                errorRetryCount: 3,
                errorRetryInterval: 1000,
            }
        );
    });
});
