import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock fetch for API calls
(globalThis as { fetch: unknown }).fetch = vi.fn();

// Mock Response constructor
(globalThis as { Response: unknown }).Response = vi.fn((body: unknown, init: unknown) => ({
  body,
  status: (init as { status?: number })?.status || 200,
  ok: ((init as { status?: number })?.status || 200) < 400,
  json: vi.fn(() => Promise.resolve(typeof body === 'string' ? JSON.parse(body) : body)),
})) as ReturnType<typeof vi.fn>;

// Mock localStorage
const localStorageMock = {
  store: new Map<string, string>(),
  getItem: vi.fn((key: string) => {
    return localStorageMock.store.get(key) || null;
  }),
  setItem: vi.fn((key: string, value: string) => {
    localStorageMock.store.set(key, value);
  }),
  removeItem: vi.fn((key: string) => {
    localStorageMock.store.delete(key);
  }),
  clear: vi.fn(() => {
    localStorageMock.store.clear();
  }),
};
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock crypto.randomUUID and getRandomValues
let uuidCounter = 0;
Object.defineProperty(globalThis, 'crypto', {
  value: {
    randomUUID: vi.fn(() => {
      uuidCounter++;
      return `550e8400-e29b-41d4-a716-44665544${uuidCounter.toString().padStart(4, '0')}`;
    }),
    getRandomValues: vi.fn((arr: Uint32Array) => {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.floor(Math.random() * 4294967296);
      }
      return arr;
    }),
  },
});
