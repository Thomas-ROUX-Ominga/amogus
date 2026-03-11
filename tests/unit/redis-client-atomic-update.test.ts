import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type MockRedisClient = {
    isOpen: boolean;
    connect: ReturnType<typeof vi.fn>;
    watch: ReturnType<typeof vi.fn>;
    get: ReturnType<typeof vi.fn>;
    unwatch: ReturnType<typeof vi.fn>;
    expire: ReturnType<typeof vi.fn>;
    multi: ReturnType<typeof vi.fn>;
    __multiSet: ReturnType<typeof vi.fn>;
    __multiExec: ReturnType<typeof vi.fn>;
};

function createMockRedisClient(): MockRedisClient {
    const multiSet = vi.fn();
    const multiExec = vi.fn();

    return {
        isOpen: true,
        connect: vi.fn().mockResolvedValue("OK"),
        watch: vi.fn().mockResolvedValue("OK"),
        get: vi.fn(),
        unwatch: vi.fn().mockResolvedValue("OK"),
        expire: vi.fn().mockResolvedValue(1),
        multi: vi.fn(() => ({
            set: multiSet,
            exec: multiExec,
        })),
        __multiSet: multiSet,
        __multiExec: multiExec,
    };
}

describe("redis.atomicUpdate", () => {
    const originalRedisUrl = process.env.REDIS_URL;
    const originalNextRuntime = process.env.NEXT_RUNTIME;

    beforeEach(() => {
        vi.resetModules();
        process.env.REDIS_URL = "redis://unit-test";
        process.env.NEXT_RUNTIME = "nodejs";
        delete (globalThis as { redis?: unknown }).redis;
        delete (globalThis as { redisConnectPromise?: unknown }).redisConnectPromise;
    });

    afterEach(() => {
        if (originalRedisUrl === undefined) {
            delete process.env.REDIS_URL;
        } else {
            process.env.REDIS_URL = originalRedisUrl;
        }

        if (originalNextRuntime === undefined) {
            delete process.env.NEXT_RUNTIME;
        } else {
            process.env.NEXT_RUNTIME = originalNextRuntime;
        }

        delete (globalThis as { redis?: unknown }).redis;
        delete (globalThis as { redisConnectPromise?: unknown }).redisConnectPromise;
        vi.restoreAllMocks();
    });

    it("retries when Redis WATCH detects concurrent modification", async () => {
        const mockClient = createMockRedisClient();
        const watchError = Object.assign(
            new Error("One (or more) of the watched keys has been changed"),
            { name: "WatchError" }
        );

        mockClient.get.mockResolvedValue(JSON.stringify({ counter: 0 }));
        mockClient.__multiExec
            .mockRejectedValueOnce(watchError)
            .mockResolvedValueOnce(["OK"]);

        (globalThis as { redis?: unknown }).redis = mockClient;
        const { redis } = await import("@/lib/redis/client");

        const updated = await redis.atomicUpdate<{ counter: number }>("game:v2:test:state", (current) => ({
            counter: (current?.counter ?? 0) + 1,
        }));

        expect(updated).toEqual({ counter: 1 });
        expect(mockClient.watch).toHaveBeenCalledTimes(2);
        expect(mockClient.multi).toHaveBeenCalledTimes(2);
        expect(mockClient.__multiSet).toHaveBeenCalledWith("game:v2:test:state", JSON.stringify({ counter: 1 }));
    });

    it("skips no-op writes and only refreshes TTL when state is unchanged", async () => {
        const mockClient = createMockRedisClient();
        const existingState = {
            id: "ABC123",
            status: "LOBBY",
            players: [],
            createdAt: 123456789,
            revision: 1,
            updatedAt: 123456789,
        };

        mockClient.get.mockResolvedValue(JSON.stringify(existingState));
        (globalThis as { redis?: unknown }).redis = mockClient;
        const { redis } = await import("@/lib/redis/client");

        const result = await redis.atomicUpdate<typeof existingState>(
            "game:v2:ABC123:state",
            (current) => current,
            86400
        );

        expect(result).toEqual(existingState);
        expect(mockClient.multi).not.toHaveBeenCalled();
        expect(mockClient.expire).toHaveBeenCalledWith("game:v2:ABC123:state", 86400);
    });
});
