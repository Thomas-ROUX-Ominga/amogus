import { vi, describe, it, expect, beforeEach } from "vitest";
import { joinGame } from "@/lib/redis/actions";
import { redis } from "@/lib/redis/client";

// Mock kv client
vi.mock("@/lib/redis/client", () => ({
    redis: {
        set: vi.fn(),
        get: vi.fn(),
    },
}));

// Valid UUID v4 for testing
const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000";

describe("joinGame", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("should successfully add a player to an existing game", async () => {
        const mockState = {
            id: "test-game",
            status: "LOBBY",
            players: [],
            createdAt: Date.now(),
        };
        vi.mocked(redis.get).mockResolvedValueOnce(mockState);

        const result = await joinGame("test-game", "Omi", VALID_UUID);

        expect(result.success).toBe(true);
        expect(result.data?.players).toHaveLength(1);
        expect(result.data?.players[0]).toEqual({
            id: VALID_UUID,
            name: "Omi",
            isAlive: true,
        });
        expect(redis.set).toHaveBeenCalled();
    });

    it("should not add a player if they are already in the game", async () => {
        const mockState = {
            id: "test-game",
            status: "LOBBY",
            players: [{ id: VALID_UUID, name: "Omi", isAlive: true }],
            createdAt: Date.now(),
        };
        vi.mocked(redis.get).mockResolvedValueOnce(mockState);

        const result = await joinGame("test-game", "Omi-Duplicate", VALID_UUID);

        expect(result.success).toBe(true);
        expect(result.data?.players).toHaveLength(1);
        expect(redis.set).not.toHaveBeenCalled();
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
});
