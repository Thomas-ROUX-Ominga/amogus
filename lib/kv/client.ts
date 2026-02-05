import { createClient } from "@vercel/kv";

// Fallback to a simple Map-based mock for local development/testing if KV env vars are missing
const isKVConfigured = process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN;

interface KVMock {
    data: Map<string, unknown>;
    get<T>(key: string): Promise<T | null>;
    set(key: string, value: unknown): Promise<unknown>;
    del(key: string): Promise<number>;
}

const globalForKv = globalThis as unknown as {
    kvMock: KVMock | undefined;
};

export interface KVClient {
    get<T>(key: string): Promise<T | null>;
    set(key: string, value: unknown): Promise<unknown>;
    del(key: string): Promise<number>;
}

export const kv: KVClient = isKVConfigured
    ? (createClient({
        url: process.env.KV_REST_API_URL!,
        token: process.env.KV_REST_API_TOKEN!,
    }) as unknown as KVClient)
    : (globalForKv.kvMock ??= {
        data: new Map<string, unknown>(),
        get: async function <T>(key: string): Promise<T | null> {
            return (this.data.get(key) as T) || null;
        },
        set: async function (key: string, value: unknown): Promise<unknown> {
            this.data.set(key, value);
            return "OK";
        },
        del: async function (key: string): Promise<number> {
            return this.data.delete(key) ? 1 : 0;
        }
    });
