import { createClient, RedisClientType } from "redis";

const redisUrl = process.env.REDIS_URL;

if (!redisUrl) {
    console.warn("REDIS_URL is not defined inside .env.local");
}

const globalForRedis = globalThis as unknown as {
    redis: RedisClientType | undefined;
};

let redisClient: RedisClientType | undefined;

if (redisUrl) {
    if (!globalForRedis.redis) {
        globalForRedis.redis = createClient({
            url: redisUrl,
        });
        globalForRedis.redis.on('error', (err: unknown) => console.error('Redis Client Error', err));
        globalForRedis.redis.connect().catch(console.error);
    }
    redisClient = globalForRedis.redis;
}

export const GAME_TTL_SECONDS = 86400; // 24 hours

export interface RedisClient {
    get<T>(key: string): Promise<T | null>;
    set(key: string, value: unknown, ttlSeconds?: number): Promise<unknown>;
    del(key: string): Promise<number>;
    atomicUpdate<T>(key: string, updater: (current: T | null) => T | null, ttlSeconds?: number): Promise<T | null>;
}

export const redis: RedisClient = {
    get: async function <T>(key: string): Promise<T | null> {
        if (!redisClient) throw new Error("Redis client not initialized");
        try {
            const data = await redisClient.get(key);
            if (!data) return null;
            try {
                return JSON.parse(data) as T;
            } catch (e) {
                console.error(`Failed to parse Redis data for key: ${key}`, e);
                return null;
            }
        } catch (error) {
            console.error("Redis Get Error:", error);
            return null;
        }
    },
    set: async function (key: string, value: unknown, ttlSeconds?: number): Promise<unknown> {
        if (!redisClient) throw new Error("Redis client not initialized");
        try {
            if (ttlSeconds) {
                return await redisClient.set(key, JSON.stringify(value), { EX: ttlSeconds });
            }
            return await redisClient.set(key, JSON.stringify(value));
        } catch (error) {
            console.error("Redis Set Error:", error);
            throw error;
        }
    },
    del: async function (key: string): Promise<number> {
        if (!redisClient) throw new Error("Redis client not initialized");
        try {
            return await redisClient.del(key);
        } catch (error) {
            console.error("Redis Del Error:", error);
            throw error;
        }
    },
    atomicUpdate: async function <T>(key: string, updater: (current: T | null) => T | null, ttlSeconds?: number): Promise<T | null> {
        if (!redisClient) throw new Error("Redis client not initialized");
        const maxRetries = 3;
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                await redisClient.watch(key);
                const raw = await redisClient.get(key);
                const current = raw ? (JSON.parse(raw) as T) : null;
                const updated = updater(current);
                if (updated === null) {
                    await redisClient.unwatch();
                    return current;
                }
                const multi = redisClient.multi();
                if (ttlSeconds) {
                    multi.set(key, JSON.stringify(updated), { EX: ttlSeconds });
                } else {
                    multi.set(key, JSON.stringify(updated));
                }
                const results = await multi.exec();
                if (results !== null) {
                    return updated;
                }
                // Transaction aborted (key changed), retry
            } catch (error) {
                try { await redisClient.unwatch(); } catch { /* ignore */ }
                throw error;
            }
        }
        throw new Error("Atomic update failed after max retries (concurrent modification)");
    }
};

