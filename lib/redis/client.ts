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

export interface RedisClient {
    get<T>(key: string): Promise<T | null>;
    set(key: string, value: unknown): Promise<unknown>;
    del(key: string): Promise<number>;
}

export const redis: RedisClient = {
    get: async function <T>(key: string): Promise<T | null> {
        if (!redisClient) return null;
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
    set: async function (key: string, value: unknown): Promise<unknown> {
        if (!redisClient) throw new Error("Redis client not initialized");
        try {
            return await redisClient.set(key, JSON.stringify(value));
        } catch (error) {
            console.error("Redis Set Error:", error);
            throw error;
        }
    },
    del: async function (key: string): Promise<number> {
        if (!redisClient) return 0;
        try {
            return await redisClient.del(key);
        } catch (error) {
            console.error("Redis Del Error:", error);
            throw error;
        }
    }
};

