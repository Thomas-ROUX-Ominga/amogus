import { describe, it, expect, vi, beforeEach } from "vitest";
import { useGameStore } from "@/lib/store/game-store";
import { getGame, joinGame, startGame, completeQuest } from "@/lib/redis/actions";
import { GameState } from "@/types/game";

// Mock the server actions
vi.mock("@/lib/redis/actions", () => ({
    getGame: vi.fn(),
    joinGame: vi.fn(),
    startGame: vi.fn(),
    completeQuest: vi.fn(),
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

    describe("completeQuestAction", () => {
        it("should call completeQuest server action and update questsCompleted", async () => {
            vi.mocked(completeQuest).mockResolvedValueOnce({
                success: true,
                data: { completedQuests: ["s1"], questsCompleted: 1 },
            });

            await useGameStore.getState().completeQuestAction("game-123", "user-1", "s1");

            const state = useGameStore.getState();
            expect(completeQuest).toHaveBeenCalledWith("game-123", "user-1", "s1");
            expect(state.questsCompleted).toBe(1);
            expect(state.isCompletingQuest).toBe(false);
            expect(state.completionError).toBeNull();
        });

        it("should set loading state during completion", async () => {
            let resolvePromise: (value: unknown) => void;
            const promise = new Promise((resolve) => { resolvePromise = resolve; });
            vi.mocked(completeQuest).mockReturnValueOnce(promise as never);

            const actionPromise = useGameStore.getState().completeQuestAction("game-123", "user-1", "s1");
            expect(useGameStore.getState().isCompletingQuest).toBe(true);

            resolvePromise!({ success: true, data: { completedQuests: ["s1"], questsCompleted: 1 } });
            await actionPromise;
            expect(useGameStore.getState().isCompletingQuest).toBe(false);
        });

        it("should set completionError on failure", async () => {
            vi.mocked(completeQuest).mockResolvedValueOnce({
                success: false,
                error: "Failed to record quest completion.",
                code: "ERR_QUEST_COMPLETE_FAILED",
            });

            await useGameStore.getState().completeQuestAction("game-123", "user-1", "s1");

            const state = useGameStore.getState();
            expect(state.completionError).toBe("Failed to record quest completion.");
            expect(state.isCompletingQuest).toBe(false);
        });

        it("should return true on success and false on failure", async () => {
            vi.mocked(completeQuest).mockResolvedValueOnce({
                success: true,
                data: { completedQuests: ["s1"], questsCompleted: 1 },
            });
            const successResult = await useGameStore.getState().completeQuestAction("game-123", "user-1", "s1");
            expect(successResult).toBe(true);

            vi.mocked(completeQuest).mockResolvedValueOnce({
                success: false,
                error: "Error",
            });
            const failResult = await useGameStore.getState().completeQuestAction("game-123", "user-1", "s1");
            expect(failResult).toBe(false);
        });
    });

    describe("fetchGame quest progress sync", () => {
        it("should sync questsCompleted from player completedQuests", async () => {
            const mockGame: GameState = {
                id: "game-123",
                status: "IN_PROGRESS",
                players: [
                    { id: "user-1", name: "Alice", role: "CREWMATE", isAlive: true, completedQuests: ["s1", "s2"] },
                ],
                createdAt: Date.now(),
            };
            vi.mocked(getGame).mockResolvedValueOnce({ success: true, data: mockGame });

            // Set userId in store context — fetchGame needs to know which player
            // The store's fetchGame syncs progress using a userId param
            await useGameStore.getState().fetchGame("game-123", "user-1");

            const state = useGameStore.getState();
            expect(state.questsCompleted).toBe(2);
            expect(state.questsTotal).toBe(9);
        });

        it("should default questsCompleted to 0 when completedQuests is undefined", async () => {
            const mockGame: GameState = {
                id: "game-123",
                status: "IN_PROGRESS",
                players: [
                    { id: "user-1", name: "Alice", role: "CREWMATE", isAlive: true },
                ],
                createdAt: Date.now(),
            };
            vi.mocked(getGame).mockResolvedValueOnce({ success: true, data: mockGame });

            await useGameStore.getState().fetchGame("game-123", "user-1");

            const state = useGameStore.getState();
            expect(state.questsCompleted).toBe(0);
            expect(state.questsTotal).toBe(9);
        });
    });

    describe("clearQuest and reset with completion state", () => {
        it("should reset completion state when clearQuest is called", () => {
            useGameStore.setState({ isCompletingQuest: true, completionError: "some error" });
            useGameStore.getState().clearQuest();
            const state = useGameStore.getState();
            expect(state.isCompletingQuest).toBe(false);
            expect(state.completionError).toBeNull();
        });

        it("should reset completion state when reset is called", () => {
            useGameStore.setState({ isCompletingQuest: true, completionError: "some error" });
            useGameStore.getState().reset();
            const state = useGameStore.getState();
            expect(state.isCompletingQuest).toBe(false);
            expect(state.completionError).toBeNull();
        });
    });
});
