import { describe, it, expect, beforeEach, vi } from "vitest";
import { useGameStore } from "@/lib/store/game-store";
import * as actions from "@/lib/redis/actions";

vi.mock("@/lib/redis/actions", () => ({
    getGame: vi.fn(),
    joinGame: vi.fn(),
    startGame: vi.fn(),
    selectRole: vi.fn(),
    completeQuest: vi.fn(),
    refreshGame: vi.fn(),
    addFailedQuest: vi.fn(),
    getPlayerFailedQuests: vi.fn(),
    eliminatePlayer: vi.fn(),
    getGameQuests: vi.fn(),
    triggerMeeting: vi.fn(),
    getMeetingView: vi.fn(),
    castMeetingVote: vi.fn(),
    cancelMeetingVote: vi.fn(),
}));

describe("GameStore - Role Selection", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        useGameStore.getState().reset();
    });

    it("should successfully select CREWMATE role", async () => {
        vi.mocked(actions.selectRole).mockResolvedValue({
            success: true,
            data: { role: "CREWMATE" },
        });

        vi.mocked(actions.getGame).mockResolvedValue({
            success: true,
            data: {
                id: "game-123",
                status: "IN_PROGRESS",
                players: [{ id: "user-456", name: "Test", role: "CREWMATE", isAlive: true }],
                createdAt: Date.now(),
            },
        });

        const store = useGameStore.getState();
        const result = await store.chooseRole("game-123", "user-456", "CREWMATE");

        expect(result).toBe(true);
        expect(useGameStore.getState().selectedRole).toBe("CREWMATE");
        expect(useGameStore.getState().isSelectingRole).toBe(false);
        expect(useGameStore.getState().roleError).toBeNull();
    });

    it("should successfully select IMPOSTOR role", async () => {
        vi.mocked(actions.selectRole).mockResolvedValue({
            success: true,
            data: { role: "IMPOSTOR" },
        });

        vi.mocked(actions.getGame).mockResolvedValue({
            success: true,
            data: {
                id: "game-123",
                status: "IN_PROGRESS",
                players: [{ id: "user-456", name: "Test", role: "IMPOSTOR", isAlive: true }],
                createdAt: Date.now(),
            },
        });

        const store = useGameStore.getState();
        const result = await store.chooseRole("game-123", "user-456", "IMPOSTOR");

        expect(result).toBe(true);
        expect(useGameStore.getState().selectedRole).toBe("IMPOSTOR");
        expect(useGameStore.getState().isSelectingRole).toBe(false);
        expect(useGameStore.getState().roleError).toBeNull();
    });

    it("should set isSelectingRole to true during role selection", async () => {
        vi.mocked(actions.selectRole).mockImplementation(() => {
            expect(useGameStore.getState().isSelectingRole).toBe(true);
            return Promise.resolve({
                success: true,
                data: { role: "CREWMATE" },
            });
        });

        vi.mocked(actions.getGame).mockResolvedValue({
            success: true,
            data: {
                id: "game-123",
                status: "IN_PROGRESS",
                players: [{ id: "user-456", name: "Test", role: "CREWMATE", isAlive: true }],
                createdAt: Date.now(),
            },
        });

        const store = useGameStore.getState();
        await store.chooseRole("game-123", "user-456", "CREWMATE");
    });

    it("should handle role selection error", async () => {
        vi.mocked(actions.selectRole).mockResolvedValue({
            success: false,
            error: "Cannot select role: game is not in progress.",
        });

        const store = useGameStore.getState();
        const result = await store.chooseRole("game-123", "user-456", "CREWMATE");

        expect(result).toBe(false);
        expect(useGameStore.getState().selectedRole).toBeNull();
        expect(useGameStore.getState().isSelectingRole).toBe(false);
        expect(useGameStore.getState().roleError).toBe("Cannot select role: game is not in progress.");
    });

    it("should clear roleError when starting new role selection", async () => {
        useGameStore.setState({ roleError: "Previous error" });

        vi.mocked(actions.selectRole).mockResolvedValue({
            success: true,
            data: { role: "CREWMATE" },
        });

        vi.mocked(actions.getGame).mockResolvedValue({
            success: true,
            data: {
                id: "game-123",
                status: "IN_PROGRESS",
                players: [{ id: "user-456", name: "Test", role: "CREWMATE", isAlive: true }],
                createdAt: Date.now(),
            },
        });

        const store = useGameStore.getState();
        await store.chooseRole("game-123", "user-456", "CREWMATE");

        expect(useGameStore.getState().roleError).toBeNull();
    });

    it("should reset role state when reset is called", () => {
        useGameStore.setState({
            selectedRole: "CREWMATE",
            isSelectingRole: true,
            roleError: "Some error",
        });

        useGameStore.getState().reset();

        expect(useGameStore.getState().selectedRole).toBeNull();
        expect(useGameStore.getState().isSelectingRole).toBe(false);
        expect(useGameStore.getState().roleError).toBeNull();
    });
});
