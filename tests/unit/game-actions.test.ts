import { vi, describe, it, expect, beforeEach } from "vitest";
import { createGame, getGame, completeQuest } from "@/lib/redis/actions";
import { redis } from "@/lib/redis/client";
import { GameState } from "@/types/game";

// Mock kv client
vi.mock("@/lib/redis/client", () => ({
    GAME_TTL_SECONDS: 86400,
    redis: {
        set: vi.fn(),
        get: vi.fn(),
        atomicUpdate: vi.fn(),
    },
}));

// Mock uuid
vi.mock("uuid", () => ({
    v4: () => "test-uuid",
}));

// Mock next/navigation
vi.mock("next/navigation", () => ({
    redirect: vi.fn(),
}));

describe("createGame", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("should create a game and store it in KV", async () => {
        const result = await createGame();

        expect(result.success).toBe(true);
        expect(result.data).toBe("test-uuid");
        expect(redis.set).toHaveBeenCalledWith(
            "game:test-uuid:state",
            expect.objectContaining({
                id: "test-uuid",
                status: "LOBBY",
                players: [],
            }),
            86400
        );
    });

    it("should return failure if KV fails", async () => {
        vi.mocked(redis.set).mockRejectedValueOnce(new Error("KV Error"));

        const result = await createGame();

        expect(result.success).toBe(false);
        expect(result.error).toContain("Failed to create game");
    });
});

describe("getGame", () => {
    // getGame is already imported at the top

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("should return game state if found", async () => {
        const mockState = { id: "test-id", status: "LOBBY", players: [] };
        vi.mocked(redis.get).mockResolvedValueOnce(mockState);

        const result = await getGame("test-id");

        expect(result.success).toBe(true);
        expect(result.data).toEqual(mockState);
        expect(redis.get).toHaveBeenCalledWith("game:test-id:state");
    });

    it("should return failure if game not found", async () => {
        vi.mocked(redis.get).mockResolvedValueOnce(null);

        const result = await getGame("test-id");

        expect(result.success).toBe(false);
        expect(result.error).toContain("not found");
    });

    it("should return failure if KV fails", async () => {
        vi.mocked(redis.get).mockRejectedValueOnce(new Error("KV Error"));

        const result = await getGame("test-id");

        expect(result.success).toBe(false);
        expect(result.error).toContain("Failed to establish link");
    });
});

describe("completeQuest", () => {
    const baseGame: GameState = {
        id: "game-123",
        status: "IN_PROGRESS",
        players: [
            { id: "user-1", name: "Alice", role: "CREWMATE", isAlive: true, completedQuests: [] },
            { id: "user-2", name: "Bob", role: "IMPOSTOR", isAlive: true, completedQuests: [] },
        ],
        createdAt: Date.now(),
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("should record quest completion successfully", async () => {
        vi.mocked(redis.atomicUpdate).mockImplementation(async (_key, updater) => {
            return updater(structuredClone(baseGame));
        });

        const result = await completeQuest("game-123", "user-1", "s1");

        expect(result.success).toBe(true);
        expect(result.data?.completedQuests).toContain("s1");
        expect(result.data?.questsCompleted).toBe(1);
    });

    it("should prevent duplicate quest completion (idempotent)", async () => {
        const gameWithCompleted = structuredClone(baseGame);
        gameWithCompleted.players[0].completedQuests = ["s1"];

        vi.mocked(redis.atomicUpdate).mockImplementation(async (_key, updater) => {
            return updater(gameWithCompleted);
        });

        const result = await completeQuest("game-123", "user-1", "s1");

        expect(result.success).toBe(true);
        expect(result.data?.completedQuests).toEqual(["s1"]);
        expect(result.data?.questsCompleted).toBe(1);
    });

    it("should return error when game not found", async () => {
        vi.mocked(redis.atomicUpdate).mockImplementation(async (_key, updater) => {
            return updater(null);
        });

        const result = await completeQuest("nonexistent", "user-1", "s1");

        expect(result.success).toBe(false);
        expect(result.code).toBe("GAME_NOT_FOUND");
    });

    it("should return error when player not found", async () => {
        vi.mocked(redis.atomicUpdate).mockImplementation(async (_key, updater) => {
            return updater(structuredClone(baseGame));
        });

        const result = await completeQuest("game-123", "unknown-user", "s1");

        expect(result.success).toBe(false);
        expect(result.code).toBe("ERR_INVALID_SIGNATURE");
    });

    it("should return error when game is not IN_PROGRESS", async () => {
        const lobbyGame = { ...structuredClone(baseGame), status: "LOBBY" as const };

        vi.mocked(redis.atomicUpdate).mockImplementation(async (_key, updater) => {
            return updater(lobbyGame);
        });

        const result = await completeQuest("game-123", "user-1", "s1");

        expect(result.success).toBe(false);
        expect(result.code).toBe("ERR_INVALID_STATE");
    });

    it("should return error on Redis failure", async () => {
        vi.mocked(redis.atomicUpdate).mockRejectedValueOnce(new Error("Redis Error"));

        const result = await completeQuest("game-123", "user-1", "s1");

        expect(result.success).toBe(false);
        expect(result.code).toBe("ERR_QUEST_COMPLETE_FAILED");
    });
});
