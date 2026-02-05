import { createClient } from "@vercel/kv";

// Fallback to a simple Map-based mock for local development/testing if KV env vars are missing
const isKVConfigured = process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN;

interface KVMock {
    data: Map<string, any>;
    get<T>(key: string): Promise<T | null>;
    set(key: string, value: any, options?: any): Promise<any>;
    del(key: string): Promise<number>;
}

const globalForKv = globalThis as unknown as {
    kvMock: KVMock | undefined;
};

export const kv: any = isKVConfigured
    ? createClient({
        url: process.env.KV_REST_API_URL!,
        token: process.env.KV_REST_API_TOKEN!,
    })
    : (globalForKv.kvMock ??= {
        data: new Map<string, any>(),
        get: async function <T>(key: string): Promise<T | null> {
            return (this.data.get(key) as T) || null;
        },
        set: async function (key: string, value: any, options?: any): Promise<any> {
            this.data.set(key, value);
            return "OK";
        },
        del: async function (key: string): Promise<number> {
            return this.data.delete(key) ? 1 : 0;
        }
    });
