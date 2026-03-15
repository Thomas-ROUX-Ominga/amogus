import { vi, describe, it, expect, beforeEach } from "vitest";
import { joinGame } from "@/lib/redis/actions";
import { redis } from "@/lib/redis/client";
import { ERROR_CODES } from "@/lib/constants/error-codes";
import { verifySession } from "@/lib/redis/auth-utils";

// Mock kv client
vi.mock("@/lib/redis/client", () => ({
    GAME_TTL_SECONDS: 86400,
    redis: {
        get: vi.fn(),
        atomicUpdate: vi.fn(),
        set: vi.fn(),
        del: vi.fn(),
        exists: vi.fn(() => Promise.resolve(0)),
    },
}));

vi.mock("@/lib/redis/auth-utils", () => ({
    createPlayerSession: vi.fn(() => Promise.resolve({ success: true })),
    verifyPlayerSession: vi.fn(() => Promise.resolve({ success: true })),
    verifySession: vi.fn(() =>
        Promise.resolve({ success: false, error: "No session", code: ERROR_CODES.ERR_NO_SESSION })
    ),
}));

// Valid UUID v4 for testing
const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000";

describe("joinGame", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(verifySession).mockResolvedValue({
            success: false,
            error: "No session",
            code: ERROR_CODES.ERR_NO_SESSION,
        });
    });

    it("should successfully add a player to an existing game", async () => {
        const mockState = {
            id: "test-game",
            status: "LOBBY",
            players: [],
            createdAt: Date.now(),
            revision: 1,
            updatedAt: Date.now(),
        };
        vi.mocked(redis.get).mockResolvedValueOnce(mockState);
        vi.mocked(redis.atomicUpdate).mockImplementationOnce(async (_key, updater) => updater(mockState));

        const result = await joinGame("test-game", "Omi", VALID_UUID);

        expect(result.success).toBe(true);
        expect(result.data?.players).toHaveLength(1);
        expect(result.data?.players[0]).toEqual({
            id: VALID_UUID,
            name: "Omi",
            isAlive: true,
        });
        expect(redis.atomicUpdate).toHaveBeenCalledWith(
            "game:v2:test-game:state",
            expect.any(Function),
            86400
        );
    });

    it("should not add a player if they are already in the game", async () => {
        const mockState = {
            id: "test-game",
            status: "LOBBY",
            players: [{ id: VALID_UUID, name: "Omi", isAlive: true }],
            createdAt: Date.now(),
            revision: 1,
            updatedAt: Date.now(),
        };
        vi.mocked(redis.get).mockResolvedValueOnce(mockState);
        vi.mocked(redis.atomicUpdate).mockImplementationOnce(async (_key, updater) => updater(mockState));

        const result = await joinGame("test-game", "Omi-Duplicate", VALID_UUID);

        expect(result.success).toBe(true);
        expect(result.data?.players).toHaveLength(1);
        expect(redis.atomicUpdate).toHaveBeenCalledTimes(1);
    });

    it("should return error if game does not exist", async () => {
        vi.mocked(redis.get).mockResolvedValueOnce(null);

        const result = await joinGame("invalid-game", "Omi", VALID_UUID);

        expect(result.success).toBe(false);
        expect(result.error).toContain("not found");
    });

    it("should return error for invalid UUID signature", async () => {
        const result = await joinGame("test-game", "Omi", "123");
        expect(result.success).toBe(false);
        expect(result.error).toContain("Invalid crew signature");
    });

    it("should reassign an in-progress player when alias matches", async () => {
        const now = Date.now();
        const mockState = {
            id: "test-game",
            status: "IN_PROGRESS" as const,
            players: [
                {
                    id: "legacy-user-abcde",
                    name: "toto",
                    isAlive: true,
                    completedQuests: ["q1"],
                    assignedQuests: ["q2"],
                },
            ],
            createdAt: now,
            revision: 1,
            updatedAt: now,
        };
        vi.mocked(redis.get)
            .mockResolvedValueOnce(mockState)
            .mockResolvedValueOnce(null);
        vi.mocked(redis.atomicUpdate).mockImplementationOnce(async (_key, updater) => updater(mockState));

        const result = await joinGame("test-game", "toto", "new-user-abcde");

        expect(result.success).toBe(true);
        expect(result.data?.players).toEqual([
            expect.objectContaining({
                id: "new-user-abcde",
                name: "toto",
                completedQuests: ["q1"],
                assignedQuests: ["q2"],
            }),
        ]);
        expect(result.data?.players.some((player) => player.id === "legacy-user-abcde")).toBe(false);
    });

    it("should refuse a new alias when game is already in progress", async () => {
        const now = Date.now();
        const mockState = {
            id: "test-game",
            status: "IN_PROGRESS" as const,
            players: [{ id: "legacy-user-abcde", name: "toto", isAlive: true }],
            createdAt: now,
            revision: 1,
            updatedAt: now,
        };
        vi.mocked(redis.get).mockResolvedValueOnce(mockState);
        vi.mocked(redis.atomicUpdate).mockImplementationOnce(async (_key, updater) => updater(mockState));

        const result = await joinGame("test-game", "nouveau", "new-user-abcde");

        expect(result.success).toBe(false);
        expect(result.code).toBe(ERROR_CODES.ERR_GAME_ALREADY_STARTED);
    });

    it("should refuse takeover when alias owner is still connected", async () => {
        const now = Date.now();
        const mockState = {
            id: "test-game",
            status: "IN_PROGRESS" as const,
            players: [{ id: "legacy-user-abcde", name: "toto", isAlive: true }],
            createdAt: now,
            revision: 1,
            updatedAt: now,
        };
        vi.mocked(redis.get).mockResolvedValueOnce(mockState);
        vi.mocked(redis.exists).mockResolvedValueOnce(0).mockResolvedValueOnce(1);

        const result = await joinGame("test-game", "toto", "new-user-abcde");

        expect(result.success).toBe(false);
        expect(result.code).toBe(ERROR_CODES.ERR_PLAYER_ALREADY_CONNECTED);
    });

    it("should require login for protected account alias", async () => {
        const now = Date.now();
        const mockState = {
            id: "test-game",
            status: "IN_PROGRESS" as const,
            players: [{ id: "protected-user-abcde", name: "orga", isAlive: true }],
            createdAt: now,
            revision: 1,
            updatedAt: now,
        };
        vi.mocked(redis.get).mockResolvedValueOnce(mockState);
        vi.mocked(redis.exists).mockResolvedValueOnce(1);

        const result = await joinGame("test-game", "orga", "new-user-abcde");

        expect(result.success).toBe(false);
        expect(result.code).toBe(ERROR_CODES.ERR_LOGIN_REQUIRED_FOR_AUTH_PLAYER);
    });

    it("should allow authenticated caller to reclaim a currently connected alias", async () => {
        const now = Date.now();
        const mockState = {
            id: "test-game",
            status: "IN_PROGRESS" as const,
            players: [{ id: "legacy-user-abcde", name: "toto", isAlive: true }],
            createdAt: now,
            revision: 1,
            updatedAt: now,
        };
        vi.mocked(verifySession).mockResolvedValueOnce({
            success: true,
            data: { userId: "new-user-abcde", username: "orga", role: "organizer" },
        });
        vi.mocked(redis.get).mockResolvedValueOnce(mockState).mockResolvedValueOnce(null);
        vi.mocked(redis.exists).mockResolvedValueOnce(0).mockResolvedValueOnce(1);
        vi.mocked(redis.atomicUpdate).mockImplementationOnce(async (_key, updater) => updater(mockState));

        const result = await joinGame("test-game", "toto", "new-user-abcde");

        expect(result.success).toBe(true);
        expect(result.data?.players.some((player) => player.id === "new-user-abcde")).toBe(true);
        expect(result.data?.players.some((player) => player.id === "legacy-user-abcde")).toBe(false);
    });
});
