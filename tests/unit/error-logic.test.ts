import { vi, describe, it, expect, beforeEach } from "vitest";
import { getGame, joinGame } from "@/lib/redis/actions";
import { redis } from "@/lib/redis/client";
import { ERROR_CODES } from "@/lib/constants/error-codes";

vi.mock("@/lib/redis/client", () => ({
    redis: {
        get: vi.fn(),
        set: vi.fn(),
    },
}));

const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000";

describe("Action Error Logic", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("getGame", () => {
        it("should return GAME_NOT_FOUND code when game does not exist", async () => {
            vi.mocked(redis.get).mockResolvedValueOnce(null);

            const result = await getGame("missing-id");

            expect(result.success).toBe(false);
            expect(result.code).toBe(ERROR_CODES.GAME_NOT_FOUND);
        });

        it("should return ERR_SIGNAL_LOST code when KV fails", async () => {
            vi.mocked(redis.get).mockRejectedValueOnce(new Error("Redis Disconnected"));

            const result = await getGame("any-id");

            expect(result.success).toBe(false);
            expect(result.code).toBe(ERROR_CODES.ERR_SIGNAL_LOST);
        });
    });

    describe("joinGame", () => {
        it("should return GAME_NOT_FOUND code when game does not exist", async () => {
            vi.mocked(redis.get).mockResolvedValueOnce(null);

            const result = await joinGame("missing-id", "Omi", VALID_UUID);

            expect(result.success).toBe(false);
            expect(result.code).toBe(ERROR_CODES.GAME_NOT_FOUND);
        });

        it("should return ERR_SIGNAL_LOST code when KV fails", async () => {
            vi.mocked(redis.get).mockRejectedValueOnce(new Error("Redis Disconnected"));

            const result = await joinGame("any-id", "Omi", VALID_UUID);

            expect(result.success).toBe(false);
            expect(result.code).toBe(ERROR_CODES.ERR_SIGNAL_LOST);
        });
    });
});
