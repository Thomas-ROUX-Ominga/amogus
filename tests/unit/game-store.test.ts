import { describe, it, expect, vi, beforeEach } from "vitest";
import { useGameStore } from "@/lib/store/game-store";
import { getGame, joinGame } from "@/lib/redis/actions";
import { GameState } from "@/types/game";

// Mock the server actions
vi.mock("@/lib/redis/actions", () => ({
    getGame: vi.fn(),
    joinGame: vi.fn(),
}));

describe("game-store", () => {
    beforeEach(() => {
        useGameStore.getState().reset();
        vi.clearAllMocks();
    });

    it("should have initial state", () => {
        const state = useGameStore.getState();
        expect(state.gameState).toBeNull();
        expect(state.isLoading).toBe(false);
        expect(state.error).toBeNull();
    });

    it("should update state on successful fetchGame", async () => {
        const mockGame: GameState = { id: "game-123", status: "LOBBY", players: [], createdAt: Date.now() };
        vi.mocked(getGame).mockResolvedValueOnce({ success: true, data: mockGame });

        await useGameStore.getState().fetchGame("game-123");

        const state = useGameStore.getState();
        expect(state.gameState).toEqual(mockGame);
        expect(state.isLoading).toBe(false);
        expect(state.error).toBeNull();
    });

    it("should set error state on fetchGame failure", async () => {
        vi.mocked(getGame).mockResolvedValueOnce({ success: false, error: "Link failed" });

        await useGameStore.getState().fetchGame("game-123");

        const state = useGameStore.getState();
        expect(state.gameState).toBeNull();
        expect(state.error).toBe("Link failed");
    });

    it("should update state on successful join", async () => {
        const mockGame: GameState = { id: "game-123", status: "LOBBY", players: [{ id: "u1", name: "Omi", isAlive: true }], createdAt: Date.now() };
        vi.mocked(joinGame).mockResolvedValueOnce({ success: true, data: mockGame });

        await useGameStore.getState().join("game-123", "Omi", "u1");

        const state = useGameStore.getState();
        expect(state.gameState).toEqual(mockGame);
        expect(state.isLoading).toBe(false);
    });
});
