import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useLocalUser } from "@/hooks/use-local-user";

const STORAGE_KEY = "amogus_user_id";

describe("useLocalUser", () => {
    beforeEach(() => {
        localStorage.clear();
        vi.clearAllMocks();
    });

    it("should generate a new userId if none exists in localStorage", () => {
        const { result } = renderHook(() => useLocalUser());

        // Initial render on client side should set the ID
        expect(result.current.userId).toBeDefined();
        expect(typeof result.current.userId).toBe("string");
        expect(localStorage.getItem(STORAGE_KEY)).toBe(result.current.userId);
    });

    it("should retrieve an existing userId from localStorage", () => {
        const existingId = "existing-test-uuid";
        localStorage.setItem(STORAGE_KEY, existingId);

        const { result } = renderHook(() => useLocalUser());

        expect(result.current.userId).toBe(existingId);
    });

    it("should persist the same userId across multiple calls", () => {
        const { result: firstResult } = renderHook(() => useLocalUser());
        const firstId = firstResult.current.userId;

        const { result: secondResult } = renderHook(() => useLocalUser());
        expect(secondResult.current.userId).toBe(firstId);
    });

    it("should fallback to a generated ID if localStorage is restricted", () => {
        const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => { });
        const storageSpy = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
            throw new Error("SecurityError: The operation is insecure.");
        });

        const { result } = renderHook(() => useLocalUser());

        expect(result.current.userId).toBeDefined();
        expect(typeof result.current.userId).toBe("string");
        expect(consoleSpy).toHaveBeenCalled();

        storageSpy.mockRestore();
        consoleSpy.mockRestore();
    });
});
