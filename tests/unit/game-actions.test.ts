import { vi, describe, it, expect, beforeEach } from "vitest";
import { createGame, getGame, getGameSnapshot, completeQuest } from "@/lib/redis/actions";
import { redis } from "@/lib/redis/client";
import { GameState } from "@/types/game";
import { createPlayerSession, verifyPlayerSession, verifySession } from "@/lib/redis/auth-utils";

// Mock kv client
vi.mock("@/lib/redis/client", () => ({
    GAME_TTL_SECONDS: 86400,
    redis: {
        set: vi.fn(),
        get: vi.fn(),
        atomicUpdate: vi.fn(),
        exists: vi.fn(() => Promise.resolve(0)), // Mock exists to return 0 (no collision)
    },
}));

// Mock quest-pool functions
vi.mock("@/lib/constants/quest-pool", () => ({
    getTotalQuestGamesCount: vi.fn(() => 9), // Mock total quest count
    getQuestGamesByDuration: vi.fn(() => []), // Mock getQuestGamesByDuration
}));

// Mock crypto with getRandomValues for generateShortCode
vi.stubGlobal("crypto", {
    randomUUID: () => "test-uuid",
    getRandomValues: (arr: Uint32Array) => {
        // Fill with predictable values for testing
        for (let i = 0; i < arr.length; i++) {
            arr[i] = i;
        }
        return arr;
    },
});

// Mock auth-utils
vi.mock("@/lib/redis/auth-utils", () => ({
    verifySession: vi.fn(() => Promise.resolve({ 
        success: true, 
        data: { userId: "test-user", username: "test-org", role: "organizer" } 
    })),
    createPlayerSession: vi.fn(() => Promise.resolve({ success: true })),
    verifyPlayerSession: vi.fn(() => Promise.resolve({ success: true })),
}));

describe("createGame", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(verifySession).mockResolvedValue({
            success: true,
            data: { userId: "test-user", username: "test-org", role: "organizer" },
        });
    });

    it("should create a game and store it in KV", async () => {
        const result = await createGame();

        expect(result.success).toBe(true);
        expect(result.data).toBe("234567");
        expect(redis.set).toHaveBeenCalledWith(
            "game:v2:234567:state",
            expect.objectContaining({
                id: "234567",
                status: "LOBBY",
                creatorId: "test-user",
                players: expect.arrayContaining([
                    expect.objectContaining({
                        id: "test-user",
                        name: "test-org",
                        role: "ADMIN",
                        isAlive: true,
                    })
                ]),
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
        vi.mocked(verifySession).mockResolvedValue({
            success: true,
            data: { userId: "test-user", username: "test-org", role: "organizer" },
        });
        vi.mocked(verifyPlayerSession).mockResolvedValue({ success: true });
        vi.mocked(createPlayerSession).mockResolvedValue({ success: true });
    });

    it("should return game state if found", async () => {
        const now = Date.now();
        const mockState = { id: "test-id", status: "LOBBY", players: [], createdAt: now, revision: 1, updatedAt: now };
        vi.mocked(redis.get).mockResolvedValueOnce(mockState);

        const result = await getGame("test-id");

        expect(result.success).toBe(true);
        expect(result.data).toEqual(mockState);
        expect(redis.get).toHaveBeenCalledWith("game:v2:test-id:state");
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

    it("auto-recovers missing player-session for joined player in progress game", async () => {
        const now = Date.now();
        vi.mocked(verifySession).mockResolvedValue({
            success: false,
            error: "No session",
            code: "ERR_NO_SESSION",
        });
        vi.mocked(verifyPlayerSession)
            .mockResolvedValueOnce({
                success: false,
                error: "No player session found",
                code: "ERR_NO_SESSION",
            })
            .mockResolvedValueOnce({ success: true });
        vi.mocked(createPlayerSession).mockResolvedValue({ success: true });
        vi.mocked(redis.get).mockResolvedValueOnce({
            id: "test-id",
            status: "IN_PROGRESS",
            players: [{ id: "joined-user", name: "Joined", isAlive: true }],
            createdAt: now,
            revision: 4,
            updatedAt: now,
        });

        const result = await getGame("test-id", "joined-user");

        expect(result.success).toBe(true);
        expect(createPlayerSession).toHaveBeenCalledWith("joined-user", "test-id");
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
        revision: 1,
        updatedAt: Date.now(),
    };

    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(verifySession).mockResolvedValue({
            success: true,
            data: { userId: "test-user", username: "test-org", role: "organizer" },
        });
        vi.mocked(verifyPlayerSession).mockResolvedValue({ success: true });
        vi.mocked(createPlayerSession).mockResolvedValue({ success: true });
        vi.mocked(redis.get).mockResolvedValue(structuredClone(baseGame));
    });

    it("should record quest completion successfully", async () => {
        vi.mocked(redis.atomicUpdate).mockImplementation(async (_key, updater) => {
            const game = structuredClone(baseGame);
            // Ensure no batchId to bypass assigned quests validation
            const result = updater(game);
            return result;
        });

        const result = await completeQuest("game-123", "user-1", "s1");

        expect(result.success).toBe(true);
        expect(result.data?.completedQuests).toContain("s1");
        expect(result.data?.questsCompleted).toBe(1);
    });

    it("should prevent duplicate quest completion (idempotent)", async () => {
        const gameWithCompleted = structuredClone(baseGame);
        gameWithCompleted.players[0].completedQuests = ["s1"];
        vi.mocked(redis.get).mockResolvedValueOnce(gameWithCompleted);

        vi.mocked(redis.atomicUpdate).mockImplementation(async (_key, updater) => {
            return updater(gameWithCompleted);
        });

        const result = await completeQuest("game-123", "user-1", "s1");

        expect(result.success).toBe(true);
        expect(result.data?.completedQuests).toEqual(["s1"]);
        expect(result.data?.questsCompleted).toBe(1);
    });

    it("should return error when game not found", async () => {
        vi.mocked(redis.get).mockResolvedValueOnce(null);

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
        vi.mocked(redis.get).mockResolvedValueOnce(lobbyGame);

        vi.mocked(redis.atomicUpdate).mockImplementation(async (_key, updater) => {
            return updater(lobbyGame);
        });

        const result = await completeQuest("game-123", "user-1", "s1");

        expect(result.success).toBe(false);
        expect(result.code).toBe("ERR_INVALID_STATE");
    });

    it("should return error on Redis failure", async () => {
        vi.mocked(redis.get).mockResolvedValueOnce(structuredClone(baseGame));
        vi.mocked(redis.atomicUpdate).mockRejectedValueOnce(new Error("Redis Error"));

        const result = await completeQuest("game-123", "user-1", "s1");

        expect(result.success).toBe(false);
        expect(result.code).toBe("ERR_QUEST_COMPLETE_FAILED");
    });
});

describe("getGameSnapshot", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(verifySession).mockResolvedValue({
            success: false,
            error: "No session",
            code: "ERR_NO_SESSION",
        });
        vi.mocked(verifyPlayerSession).mockResolvedValue({ success: true });
        vi.mocked(createPlayerSession).mockResolvedValue({ success: true });
    });

    it("should allow lobby snapshot for users not joined yet", async () => {
        const now = Date.now();
        vi.mocked(redis.get).mockResolvedValueOnce({
            id: "game-lobby",
            status: "LOBBY",
            players: [{ id: "host", name: "Host", isAlive: true }],
            createdAt: now,
            revision: 1,
            updatedAt: now,
        });

        const result = await getGameSnapshot("game-lobby", "anonymous-user");

        expect(result.success).toBe(true);
        expect(result.data?.status).toBe("LOBBY");
    });

    it("should block snapshot for unknown users once game is in progress", async () => {
        const now = Date.now();
        vi.mocked(redis.get).mockResolvedValueOnce({
            id: "game-live",
            status: "IN_PROGRESS",
            players: [{ id: "known-user", name: "Known", isAlive: true }],
            createdAt: now,
            revision: 2,
            updatedAt: now,
        });

        const result = await getGameSnapshot("game-live", "unknown-user");

        expect(result.success).toBe(false);
        expect(result.code).toBe("ERR_INVALID_SIGNATURE");
    });

    it("auto-recovers missing player-session for joined player in progress game", async () => {
        const now = Date.now();
        vi.mocked(redis.get).mockResolvedValueOnce({
            id: "game-live",
            status: "IN_PROGRESS",
            players: [{ id: "known-user", name: "Known", isAlive: true }],
            createdAt: now,
            revision: 2,
            updatedAt: now,
        });
        vi.mocked(verifyPlayerSession)
            .mockResolvedValueOnce({
                success: false,
                error: "No player session found",
                code: "ERR_NO_SESSION",
            })
            .mockResolvedValueOnce({ success: true });

        const result = await getGameSnapshot("game-live", "known-user");

        expect(result.success).toBe(true);
        expect(createPlayerSession).toHaveBeenCalledWith("known-user", "game-live");
    });

    it("propagates auto-repair failure when player-session recreation fails", async () => {
        const now = Date.now();
        vi.mocked(redis.get).mockResolvedValueOnce({
            id: "game-live",
            status: "IN_PROGRESS",
            players: [{ id: "known-user", name: "Known", isAlive: true }],
            createdAt: now,
            revision: 2,
            updatedAt: now,
        });
        vi.mocked(verifyPlayerSession).mockResolvedValueOnce({
            success: false,
            error: "No player session found",
            code: "ERR_NO_SESSION",
        });
        vi.mocked(createPlayerSession).mockResolvedValueOnce({
            success: false,
            error: "Failed to create player session",
            code: "ERR_SIGNAL_LOST",
        });

        const result = await getGameSnapshot("game-live", "known-user");

        expect(result.success).toBe(false);
        expect(result.code).toBe("ERR_SIGNAL_LOST");
        expect(result.error).toBe("Failed to create player session");
    });
});
