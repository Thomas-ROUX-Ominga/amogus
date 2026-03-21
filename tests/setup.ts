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

// Minimal browser APIs used by React Flow and pointer-heavy mini-games
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

if (!(globalThis as { ResizeObserver?: unknown }).ResizeObserver) {
  Object.defineProperty(globalThis, 'ResizeObserver', {
    value: ResizeObserverMock,
    configurable: true,
  });
}

if (!(window as { visualViewport?: unknown }).visualViewport) {
  Object.defineProperty(window, 'visualViewport', {
    value: {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      width: 0,
      height: 0,
      offsetLeft: 0,
      offsetTop: 0,
      pageLeft: 0,
      pageTop: 0,
      scale: 1,
    },
    configurable: true,
  });
}

class DOMMatrixReadOnlyMock {
  m11: number;
  m22: number;
  m41: number;
  m42: number;

  constructor(transform?: string) {
    this.m11 = 1;
    this.m22 = 1;
    this.m41 = 0;
    this.m42 = 0;

    if (!transform || transform === "none") return;

    const values = transform
      .replace(/matrix3d|matrix|\(|\)/g, "")
      .split(",")
      .map((value) => Number(value.trim()))
      .filter((value) => Number.isFinite(value));

    if (transform.startsWith("matrix3d") && values.length >= 16) {
      this.m11 = values[0];
      this.m22 = values[5];
      this.m41 = values[12];
      this.m42 = values[13];
      return;
    }

    if (transform.startsWith("matrix") && values.length >= 6) {
      this.m11 = values[0];
      this.m22 = values[3];
      this.m41 = values[4];
      this.m42 = values[5];
    }
  }
}

if (!(window as { DOMMatrixReadOnly?: unknown }).DOMMatrixReadOnly) {
  Object.defineProperty(window, "DOMMatrixReadOnly", {
    value: DOMMatrixReadOnlyMock,
    configurable: true,
  });
}

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

function getByPath(
  obj: Record<string, unknown>,
  path: string,
): string | undefined {
  const value = path.split(".").reduce<unknown>((acc, part) => {
    if (acc && typeof acc === "object" && part in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[part];
    }
    return undefined;
  }, obj);

  return typeof value === "string" ? value : undefined;
}

function interpolate(template: string, values?: Record<string, unknown>) {
  if (!values) return template;
  return template.replace(/\{(\w+)\}/g, (_, key) => String(values[key] ?? `{${key}}`));
}

vi.mock("next-intl", async () => {
  const React = await import("react");
  const frMessages = (await import("@/lib/i18n/messages/fr")).default as Record<string, unknown>;
  const translationFns = new Map<string | undefined, (key: string, values?: Record<string, unknown>) => string>();

  return {
    NextIntlClientProvider: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    useLocale: () => "fr",
    useTranslations: (namespace?: string) => {
      const existing = translationFns.get(namespace);
      if (existing) return existing;

      const translator = (key: string, values?: Record<string, unknown>) => {
        const fullKey = namespace ? `${namespace}.${key}` : key;
        const message = getByPath(frMessages, fullKey) ?? fullKey;
        return interpolate(message, values);
      };
      translationFns.set(namespace, translator);
      return translator;
    },
  };
});
