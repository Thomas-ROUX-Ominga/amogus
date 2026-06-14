const redisUrl = process.env.REDIS_URL;

if (!redisUrl) {
    console.warn("REDIS_URL is not defined inside .env.local");
}

const globalForRedis = globalThis as unknown as {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    redis: any | undefined;
    redisConnectPromise: Promise<void> | undefined;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let redisClient: any | undefined;
let redisConnectPromise: Promise<void> | undefined;

if (redisUrl && process.env.NEXT_RUNTIME !== 'edge') {
    if (!globalForRedis.redis) {
        try {
            // Using require to avoid Edge Runtime bundling issues
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const { createClient } = require("redis");
            globalForRedis.redis = createClient({
                url: redisUrl,
            });
            globalForRedis.redis.on('error', (err: unknown) => console.error('Redis Client Error', err));
            globalForRedis.redisConnectPromise = globalForRedis.redis.connect().catch((error: unknown) => {
                globalForRedis.redisConnectPromise = undefined;
                throw error;
            });
        } catch (e) {
            console.error("Failed to load redis package:", e);
        }
    }
    redisClient = globalForRedis.redis;
    redisConnectPromise = globalForRedis.redisConnectPromise;
}

export const GAME_TTL_SECONDS = 86400; // 24 hours
const ATOMIC_UPDATE_MAX_RETRIES = 10;

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function getRetryDelayMs(attempt: number): number {
    const baseDelayMs = 10 * (attempt + 1);
    const jitterMs = Math.floor(Math.random() * 10);
    return baseDelayMs + jitterMs;
}

function isRetryableWatchError(error: unknown): boolean {
    if (!error || typeof error !== "object") {
        return false;
    }

    const withName = error as { name?: unknown; message?: unknown };
    if (withName.name === "WatchError") {
        return true;
    }

    if (typeof withName.message !== "string") {
        return false;
    }

    const message = withName.message.toLowerCase();
    return message.includes("watched keys") && message.includes("changed");
}

async function ensureConnectedClient() {
    if (!redisClient) {
        throw new Error("Redis client not initialized");
    }

    if (redisClient.isOpen) {
        return redisClient;
    }

    if (!redisConnectPromise) {
        redisConnectPromise = redisClient.connect().catch((error: unknown) => {
            redisConnectPromise = undefined;
            throw error;
        });
        globalForRedis.redisConnectPromise = redisConnectPromise;
    }

    await redisConnectPromise;
    return redisClient;
}

export interface RedisClient {
    get<T>(key: string): Promise<T | null>;
    set(key: string, value: unknown, ttlSeconds?: number): Promise<unknown>;
    del(key: string): Promise<number>;
    keys(pattern: string): Promise<string[]>;
    exists(key: string): Promise<number>;
    sAdd(key: string, ...members: string[]): Promise<number>;
    sRem(key: string, ...members: string[]): Promise<number>;
    sMembers(key: string): Promise<string[]>;
    atomicUpdate<T>(key: string, updater: (current: T | null) => T | null, ttlSeconds?: number): Promise<T | null>;
}

export const redis: RedisClient = {
    get: async function <T>(key: string): Promise<T | null> {
        const client = await ensureConnectedClient();
        try {
            const data = await client.get(key);
            if (!data) return null;
            try {
                return JSON.parse(data) as T;
            } catch (e) {
                console.error(`Failed to parse Redis data for key: ${key}`, e);
                throw e;
            }
        } catch (error) {
            console.error("Redis Get Error:", error);
            throw error;
        }
    },
    set: async function (key: string, value: unknown, ttlSeconds?: number): Promise<unknown> {
        const client = await ensureConnectedClient();
        try {
            if (ttlSeconds) {
                return await client.set(key, JSON.stringify(value), { EX: ttlSeconds });
            }
            return await client.set(key, JSON.stringify(value));
        } catch (error) {
            console.error("Redis Set Error:", error);
            throw error;
        }
    },
    del: async function (key: string): Promise<number> {
        const client = await ensureConnectedClient();
        try {
            return await client.del(key);
        } catch (error) {
            console.error("Redis Del Error:", error);
            throw error;
        }
    },
    keys: async function (pattern: string): Promise<string[]> {
        const client = await ensureConnectedClient();
        try {
            return await client.keys(pattern);
        } catch (error) {
            console.error("Redis Keys Error:", error);
            throw error;
        }
    },
    exists: async function (key: string): Promise<number> {
        const client = await ensureConnectedClient();
        try {
            return await client.exists(key);
        } catch (error) {
            console.error("Redis Exists Error:", error);
            throw error;
        }
    },
    sAdd: async function (key: string, ...members: string[]): Promise<number> {
        const client = await ensureConnectedClient();
        try {
            return await client.sAdd(key, members);
        } catch (error) {
            console.error("Redis SAdd Error:", error);
            throw error;
        }
    },
    sRem: async function (key: string, ...members: string[]): Promise<number> {
        const client = await ensureConnectedClient();
        try {
            return await client.sRem(key, members);
        } catch (error) {
            console.error("Redis SRem Error:", error);
            throw error;
        }
    },
    sMembers: async function (key: string): Promise<string[]> {
        const client = await ensureConnectedClient();
        try {
            return await client.sMembers(key);
        } catch (error) {
            console.error("Redis SMembers Error:", error);
            throw error;
        }
    },
    atomicUpdate: async function <T>(key: string, updater: (current: T | null) => T | null, ttlSeconds?: number): Promise<T | null> {
        const client = await ensureConnectedClient();
        const maxRetries = ATOMIC_UPDATE_MAX_RETRIES;
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                await client.watch(key);
                const raw = await client.get(key);
                const current = raw ? (JSON.parse(raw) as T) : null;
                const updated = updater(current);
                if (updated === null) {
                    await client.unwatch();
                    return current;
                }
                const serializedUpdated = JSON.stringify(updated);

                // Avoid no-op writes that amplify contention under high polling load.
                if (raw !== null && raw === serializedUpdated) {
                    await client.unwatch();
                    if (ttlSeconds) {
                        await client.expire(key, ttlSeconds);
                    }
                    return current;
                }
                const multi = client.multi();
                if (ttlSeconds) {
                    multi.set(key, serializedUpdated, { EX: ttlSeconds });
                } else {
                    multi.set(key, serializedUpdated);
                }
                const results = await multi.exec();
                if (results !== null) {
                    return updated;
                }
                // Transaction aborted (key changed), retry
            } catch (error) {
                try { await client.unwatch(); } catch { /* ignore */ }
                if (isRetryableWatchError(error) && attempt < maxRetries - 1) {
                    await sleep(getRetryDelayMs(attempt));
                    continue;
                }
                throw error;
            }

            if (attempt < maxRetries - 1) {
                await sleep(getRetryDelayMs(attempt));
            }
        }
        throw new Error(`Atomic update failed after ${maxRetries} retries (concurrent modification)`);
    }
};
