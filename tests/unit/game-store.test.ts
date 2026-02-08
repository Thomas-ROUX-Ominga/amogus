import { describe, it, expect, vi, beforeEach } from "vitest";
import { useGameStore } from "@/lib/store/game-store";
import { getGame, joinGame, startGame } from "@/lib/redis/actions";
import { GameState } from "@/types/game";

// Mock the server actions
vi.mock("@/lib/redis/actions", () => ({
    getGame: vi.fn(),
    joinGame: vi.fn(),
    startGame: vi.fn(),
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
        expect(state.launchError).toBeNull();
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

    it("should update state on successful launch", async () => {
        const mockGame: GameState = { id: "game-123", status: "IN_PROGRESS", players: [{ id: "u1", name: "Omi", isAlive: true }], createdAt: Date.now() };
        vi.mocked(startGame).mockResolvedValueOnce({ success: true, data: mockGame });

        const result = await useGameStore.getState().launch("game-123");

        const state = useGameStore.getState();
        expect(result).toBe(true);
        expect(state.gameState).toEqual(mockGame);
        expect(state.isLaunching).toBe(false);
    });

    it("should set error state on launch failure", async () => {
        vi.mocked(startGame).mockResolvedValueOnce({ success: false, error: "No players", code: "ERR_NO_PLAYERS" });

        const result = await useGameStore.getState().launch("game-123");

        const state = useGameStore.getState();
        expect(result).toBe(false);
        expect(state.launchError).toBe("No players");
        expect(state.error).toBeNull();
        expect(state.isLaunching).toBe(false);
    });

    describe("questAnswered", () => {
        it("should have questAnswered default to false", () => {
            const state = useGameStore.getState();
            expect(state.questAnswered).toBe(false);
        });

        it("should set questAnswered to true via setQuestAnswered", () => {
            useGameStore.getState().setQuestAnswered(true);
            expect(useGameStore.getState().questAnswered).toBe(true);
        });

        it("should set questAnswered back to false via setQuestAnswered", () => {
            useGameStore.getState().setQuestAnswered(true);
            useGameStore.getState().setQuestAnswered(false);
            expect(useGameStore.getState().questAnswered).toBe(false);
        });

        it("should reset questAnswered when clearQuest is called", () => {
            useGameStore.getState().setQuestAnswered(true);
            useGameStore.getState().clearQuest();
            expect(useGameStore.getState().questAnswered).toBe(false);
        });

        it("should reset questAnswered when reset is called", () => {
            useGameStore.getState().setQuestAnswered(true);
            useGameStore.getState().reset();
            expect(useGameStore.getState().questAnswered).toBe(false);
        });
    });
});
