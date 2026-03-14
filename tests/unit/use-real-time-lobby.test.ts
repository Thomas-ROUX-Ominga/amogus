import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GameState } from "@/types/game";
import { useGameStore, useRealTimeGamePolling } from "@/lib/store/game-store";

type MockListener = (event: globalThis.MessageEvent<string>) => void;

class MockEventSource {
    static instances: MockEventSource[] = [];
    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSED = 2;

    url: string;
    readyState = 0;
    private listeners = new Map<string, Set<MockListener>>();

    constructor(url: string) {
        this.url = url;
        MockEventSource.instances.push(this);
    }

    addEventListener(type: string, listener: MockListener) {
        const listeners = this.listeners.get(type) ?? new Set<MockListener>();
        listeners.add(listener);
        this.listeners.set(type, listeners);
    }

    removeEventListener(type: string, listener: MockListener) {
        this.listeners.get(type)?.delete(listener);
    }

    close() {
        this.readyState = 2;
    }

    emit(type: string, payload?: unknown) {
        const listeners = this.listeners.get(type);
        if (!listeners) return;
        const data = payload === undefined ? undefined : JSON.stringify(payload);
        const event = new globalThis.MessageEvent(type, { data });
        listeners.forEach((listener) => listener(event));
    }
}

const now = Date.now();
const baseState: GameState = {
    id: "test-game",
    status: "LOBBY",
    players: [
        { id: "user1", name: "Player 1", isAlive: true, completedQuests: [] },
        { id: "user2", name: "Player 2", isAlive: true, completedQuests: [] },
    ],
    createdAt: now,
    revision: 1,
    updatedAt: now,
};

describe("useRealTimeGamePolling", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        MockEventSource.instances = [];
        useGameStore.getState().reset();
        useGameStore.setState({ gameState: baseState });

        vi.stubGlobal("EventSource", MockEventSource as unknown as typeof globalThis.EventSource);
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue({
                ok: true,
                status: 200,
                json: vi.fn().mockResolvedValue({ success: true, data: baseState }),
            } as unknown as Response)
        );
    });

    it("returns defaults when gameId is missing", () => {
        const { result } = renderHook(() => useRealTimeGamePolling("", "user1"));

        expect(result.current.gameState).toBeNull();
        expect(result.current.playerCount).toBe(0);
        expect(result.current.isGameInProgress).toBe(false);
        expect(result.current.isConnected).toBe(false);
    });

    it("connects through SSE and exposes connected sync status", async () => {
        const { result } = renderHook(() => useRealTimeGamePolling("test-game", "user1"));

        expect(MockEventSource.instances).toHaveLength(1);
        const source = MockEventSource.instances[0];

        await act(async () => {
            source.emit("open");
            source.emit("snapshot", {
                gameState: {
                    ...baseState,
                    revision: 2,
                    updatedAt: now + 1,
                },
                revision: 2,
                updatedAt: now + 1,
            });
        });

        await waitFor(() => {
            expect(result.current.isConnected).toBe(true);
            expect(result.current.syncStatus).toBe("connected");
            expect(result.current.gameState?.revision).toBe(2);
        });
    });

    it("keeps newest revision when events arrive out of order", async () => {
        const { result } = renderHook(() => useRealTimeGamePolling("test-game", "user1"));
        const source = MockEventSource.instances[0];

        await act(async () => {
            source.emit("open");
            source.emit("state", {
                gameState: {
                    ...baseState,
                    revision: 5,
                    updatedAt: now + 5,
                },
                revision: 5,
                updatedAt: now + 5,
            });
            source.emit("state", {
                gameState: {
                    ...baseState,
                    revision: 4,
                    updatedAt: now + 4,
                },
                revision: 4,
                updatedAt: now + 4,
            });
        });

        await waitFor(() => {
            expect(result.current.gameState?.revision).toBe(5);
        });
    });

    it("falls back to reconnecting status on stream error", async () => {
        const { result } = renderHook(() => useRealTimeGamePolling("test-game", "user1"));
        const source = MockEventSource.instances[0];

        await waitFor(() => {
            expect(result.current.syncStatus).toBe("connected");
        });

        await act(async () => {
            source.emit("error", { error: "Connection lost", code: "ERR_SIGNAL_LOST" });
        });

        await waitFor(() => {
            expect(result.current.syncStatus === "reconnecting" || result.current.syncStatus === "degraded").toBe(true);
        });
    });

    it("cleans up new-player timers on unmount", async () => {
        vi.useFakeTimers();
        try {
            const { unmount } = renderHook(() => useRealTimeGamePolling("test-game", "user1"));
            const source = MockEventSource.instances[0];

            await act(async () => {
                source.emit("open");
                source.emit("state", {
                    gameState: {
                        ...baseState,
                        players: [
                            ...baseState.players,
                            { id: "user3", name: "Player 3", isAlive: true, completedQuests: [] },
                        ],
                        revision: 2,
                        updatedAt: now + 2,
                    },
                    revision: 2,
                    updatedAt: now + 2,
                });
            });

            expect(vi.getTimerCount()).toBeGreaterThan(0);
            unmount();
            expect(vi.getTimerCount()).toBe(0);
        } finally {
            vi.useRealTimers();
        }
    });

    it("clears new players and timers when gameId or userId becomes invalid", async () => {
        vi.useFakeTimers();
        try {
            const { result, rerender } = renderHook(
                ({ gameId, userId }) => useRealTimeGamePolling(gameId, userId),
                {
                    initialProps: { gameId: "test-game", userId: "user1" },
                }
            );
            const source = MockEventSource.instances[0];

            await act(async () => {
                source.emit("open");
                await vi.advanceTimersByTimeAsync(2000);
            });
            expect(result.current.newPlayers).toHaveLength(0);

            await act(async () => {
                source.emit("state", {
                    gameState: {
                        ...baseState,
                        players: [
                            ...baseState.players,
                            { id: "user3", name: "Player 3", isAlive: true, completedQuests: [] },
                        ],
                        revision: 2,
                        updatedAt: now + 2,
                    },
                    revision: 2,
                    updatedAt: now + 2,
                });
            });
            expect(result.current.newPlayers.some((player) => player.id === "user3")).toBe(true);
            expect(vi.getTimerCount()).toBeGreaterThan(0);

            await act(async () => {
                rerender({ gameId: "", userId: "user1" });
                await vi.advanceTimersByTimeAsync(0);
            });
            expect(result.current.newPlayers).toHaveLength(0);
            expect(vi.getTimerCount()).toBe(0);
        } finally {
            vi.useRealTimers();
        }
    });

    it("keeps realtime sync active for eliminated impostor until FINISHED and applies winner update", async () => {
        const eliminatedImpostorState: GameState = {
            ...baseState,
            status: "IN_PROGRESS",
            players: [
                { id: "user1", name: "Impostor", role: "IMPOSTOR", isAlive: false, completedQuests: [] },
                { id: "user2", name: "Crewmate", role: "CREWMATE", isAlive: true, completedQuests: [] },
            ],
            revision: 10,
            updatedAt: now + 10,
        };
        useGameStore.setState({ gameState: eliminatedImpostorState });

        const { result } = renderHook(() => useRealTimeGamePolling("test-game", "user1"));

        expect(MockEventSource.instances).toHaveLength(1);
        const source = MockEventSource.instances[0];

        await act(async () => {
            source.emit("open");
            source.emit("state", {
                gameState: {
                    ...eliminatedImpostorState,
                    status: "FINISHED",
                    winner: "IMPOSTOR",
                    revision: 11,
                    updatedAt: now + 11,
                },
                revision: 11,
                updatedAt: now + 11,
            });
        });

        await waitFor(() => {
            expect(result.current.gameState?.status).toBe("FINISHED");
            expect(result.current.gameState?.winner).toBe("IMPOSTOR");
            expect(result.current.isGameFinished).toBe(true);
        });
    });

    it("does not start SSE when game is already finished", async () => {
        useGameStore.setState({
            gameState: {
                ...baseState,
                status: "FINISHED",
                winner: "CREWMATE",
                revision: 4,
                updatedAt: now + 4,
            },
        });

        const { result } = renderHook(() => useRealTimeGamePolling("test-game", "user1"));

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });
        expect(result.current.isGameFinished).toBe(true);
        expect(MockEventSource.instances).toHaveLength(0);
        expect(fetch).not.toHaveBeenCalled();
    });
});
