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

    readyState = 0;
    private listeners = new Map<string, Set<MockListener>>();

    constructor(_url: string) {
        MockEventSource.instances.push(this);
    }

    addEventListener(type: string, listener: MockListener) {
        const listeners = this.listeners.get(type) ?? new Set<MockListener>();
        listeners.add(listener);
        this.listeners.set(type, listeners);
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

const createGameState = (players: GameState["players"], revision: number, status: GameState["status"] = "LOBBY"): GameState => ({
    id: "test-game-123",
    status,
    players,
    createdAt: now,
    revision,
    updatedAt: now + revision,
});

describe("Real-time Lobby Integration", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        MockEventSource.instances = [];
        useGameStore.getState().reset();

        vi.stubGlobal("EventSource", MockEventSource as unknown as typeof globalThis.EventSource);

        const initialState = createGameState(
            [
                { id: "user1", name: "Player 1", isAlive: true, completedQuests: [] },
                { id: "user2", name: "Player 2", isAlive: true, completedQuests: [] },
            ],
            1,
        );

        useGameStore.setState({ gameState: initialState });

        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue({
                ok: true,
                status: 200,
                json: vi.fn().mockResolvedValue({ success: true, data: initialState }),
            } as unknown as Response)
        );
    });

    it("reflects player count updates from SSE", async () => {
        const { result } = renderHook(() => useRealTimeGamePolling("test-game-123", "user1"));
        const source = MockEventSource.instances[0];

        await act(async () => {
            source.emit("open");
            source.emit("state", {
                gameState: createGameState(
                    [
                        { id: "user1", name: "Player 1", isAlive: true, completedQuests: [] },
                        { id: "user2", name: "Player 2", isAlive: true, completedQuests: [] },
                        { id: "user3", name: "Player 3", isAlive: true, completedQuests: [] },
                    ],
                    2,
                ),
                revision: 2,
                updatedAt: now + 2,
            });
        });

        await waitFor(() => {
            expect(result.current.playerCount).toBe(3);
            expect(result.current.newPlayers.some((player) => player.id === "user3")).toBe(true);
            expect(result.current.isConnected).toBe(true);
        });
    });

    it("tracks in-progress transition for redirect flows", async () => {
        const { result } = renderHook(() => useRealTimeGamePolling("test-game-123", "user1"));
        const source = MockEventSource.instances[0];

        await act(async () => {
            source.emit("open");
            source.emit("state", {
                gameState: createGameState(
                    [
                        { id: "user1", name: "Player 1", isAlive: true, role: "CREWMATE", completedQuests: [] },
                        { id: "user2", name: "Player 2", isAlive: true, completedQuests: [] },
                    ],
                    3,
                    "IN_PROGRESS",
                ),
                revision: 3,
                updatedAt: now + 3,
            });
        });

        await waitFor(() => {
            expect(result.current.isGameInProgress).toBe(true);
            expect(result.current.gameState?.status).toBe("IN_PROGRESS");
        });
    });

    it("keeps a newly joined player highlighted for 2 seconds, then clears it", async () => {
        vi.useFakeTimers();
        try {
            const { result } = renderHook(() => useRealTimeGamePolling("test-game-123", "user1"));
            const source = MockEventSource.instances[0];

            // Clear initial highlights from baseline players.
            await act(async () => {
                source.emit("open");
                await vi.advanceTimersByTimeAsync(2000);
            });
            expect(result.current.newPlayers).toHaveLength(0);

            await act(async () => {
                source.emit("state", {
                    gameState: createGameState(
                        [
                            { id: "user1", name: "Player 1", isAlive: true, completedQuests: [] },
                            { id: "user2", name: "Player 2", isAlive: true, completedQuests: [] },
                            { id: "user3", name: "Player 3", isAlive: true, completedQuests: [] },
                        ],
                        2,
                    ),
                    revision: 2,
                    updatedAt: now + 2,
                });
            });
            expect(result.current.newPlayers.some((player) => player.id === "user3")).toBe(true);

            await act(async () => {
                await vi.advanceTimersByTimeAsync(2000);
            });
            expect(result.current.newPlayers.some((player) => player.id === "user3")).toBe(false);
        } finally {
            vi.useRealTimers();
        }
    });

    it("keeps independent timers for players joining at different moments", async () => {
        vi.useFakeTimers();
        try {
            const { result } = renderHook(() => useRealTimeGamePolling("test-game-123", "user1"));
            const source = MockEventSource.instances[0];

            await act(async () => {
                source.emit("open");
                await vi.advanceTimersByTimeAsync(2000);
            });
            expect(result.current.newPlayers).toHaveLength(0);

            await act(async () => {
                source.emit("state", {
                    gameState: createGameState(
                        [
                            { id: "user1", name: "Player 1", isAlive: true, completedQuests: [] },
                            { id: "user2", name: "Player 2", isAlive: true, completedQuests: [] },
                            { id: "user3", name: "Player 3", isAlive: true, completedQuests: [] },
                        ],
                        2,
                    ),
                    revision: 2,
                    updatedAt: now + 2,
                });
            });

            await act(async () => {
                await vi.advanceTimersByTimeAsync(1000);
                source.emit("state", {
                    gameState: createGameState(
                        [
                            { id: "user1", name: "Player 1", isAlive: true, completedQuests: [] },
                            { id: "user2", name: "Player 2", isAlive: true, completedQuests: [] },
                            { id: "user3", name: "Player 3", isAlive: true, completedQuests: [] },
                            { id: "user4", name: "Player 4", isAlive: true, completedQuests: [] },
                        ],
                        3,
                    ),
                    revision: 3,
                    updatedAt: now + 3,
                });
            });

            expect(result.current.newPlayers.some((player) => player.id === "user3")).toBe(true);
            expect(result.current.newPlayers.some((player) => player.id === "user4")).toBe(true);

            // user3 expires first
            await act(async () => {
                await vi.advanceTimersByTimeAsync(1000);
            });
            expect(result.current.newPlayers.some((player) => player.id === "user3")).toBe(false);
            expect(result.current.newPlayers.some((player) => player.id === "user4")).toBe(true);

            // then user4 expires
            await act(async () => {
                await vi.advanceTimersByTimeAsync(1000);
            });
            expect(result.current.newPlayers.some((player) => player.id === "user4")).toBe(false);
        } finally {
            vi.useRealTimers();
        }
    });

    it("does not reset a highlighted player's timer on non-join SSE updates", async () => {
        vi.useFakeTimers();
        try {
            const { result } = renderHook(() => useRealTimeGamePolling("test-game-123", "user1"));
            const source = MockEventSource.instances[0];

            await act(async () => {
                source.emit("open");
                await vi.advanceTimersByTimeAsync(2000);
            });
            expect(result.current.newPlayers).toHaveLength(0);

            await act(async () => {
                source.emit("state", {
                    gameState: createGameState(
                        [
                            { id: "user1", name: "Player 1", isAlive: true, completedQuests: [] },
                            { id: "user2", name: "Player 2", isAlive: true, completedQuests: [] },
                            { id: "user3", name: "Player 3", isAlive: true, completedQuests: [] },
                        ],
                        2,
                    ),
                    revision: 2,
                    updatedAt: now + 2,
                });
                await vi.advanceTimersByTimeAsync(1500);
            });

            await act(async () => {
                // Same players, only revision changed: should not restart user3 timer.
                source.emit("state", {
                    gameState: createGameState(
                        [
                            { id: "user1", name: "Player 1", isAlive: true, completedQuests: [] },
                            { id: "user2", name: "Player 2", isAlive: true, completedQuests: [] },
                            { id: "user3", name: "Player 3", isAlive: true, completedQuests: [] },
                        ],
                        3,
                    ),
                    revision: 3,
                    updatedAt: now + 3,
                });
                await vi.advanceTimersByTimeAsync(500);
            });
            expect(result.current.newPlayers.some((player) => player.id === "user3")).toBe(false);
        } finally {
            vi.useRealTimers();
        }
    });
});
