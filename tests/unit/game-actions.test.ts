import { vi, describe, it, expect, beforeEach } from "vitest";
import { createGame, getGame } from "@/lib/redis/actions";
import { redis } from "@/lib/redis/client";

// Mock kv client
vi.mock("@/lib/redis/client", () => ({
    redis: {
        set: vi.fn(),
        get: vi.fn(),
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
            })
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
