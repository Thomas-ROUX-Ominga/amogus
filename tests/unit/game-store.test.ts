import { vi, describe, it, expect, beforeEach } from "vitest";
import { useGameStore } from "@/lib/store/game-store";
import { getGame } from "@/lib/kv/actions";

// Mock getGame action
vi.mock("@/lib/kv/actions", () => ({
    getGame: vi.fn(),
}));

describe("useGameStore", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Reset store state before each test if possible, or just use reset()
        useGameStore.getState().reset();
    });

    it("should have initial state", () => {
        const state = useGameStore.getState();
        expect(state.gameState).toBeNull();
        expect(state.isLoading).toBe(false);
        expect(state.error).toBeNull();
    });

    it("should fetch game successfully", async () => {
        const mockGame = { id: "test-id", status: "LOBBY", players: [] };
        (getGame as any).mockResolvedValueOnce({ success: true, data: mockGame });

        await useGameStore.getState().fetchGame("test-id");

        const state = useGameStore.getState();
        expect(state.gameState).toEqual(mockGame);
        expect(state.isLoading).toBe(false);
        expect(state.error).toBeNull();
        expect(getGame).toHaveBeenCalledWith("test-id");
    });

    it("should handle fetch game failure", async () => {
        (getGame as any).mockResolvedValueOnce({ success: false, error: "Game not found" });

        await useGameStore.getState().fetchGame("test-id");

        const state = useGameStore.getState();
        expect(state.gameState).toBeNull();
        expect(state.isLoading).toBe(false);
        expect(state.error).toBe("Game not found");
    });

    it("should handle unexpected fetch game failure", async () => {
        (getGame as any).mockResolvedValueOnce({ success: false });

        await useGameStore.getState().fetchGame("test-id");

        const state = useGameStore.getState();
        expect(state.error).toBe("Unknown error");
        expect(state.isLoading).toBe(false);
    });

    it("should reset state", () => {
        // Set some state first
        useGameStore.setState({ gameState: {} as any, error: "some error", isLoading: true });

        useGameStore.getState().reset();

        const state = useGameStore.getState();
        expect(state.gameState).toBeNull();
        expect(state.isLoading).toBe(false);
        expect(state.error).toBeNull();
    });
});
