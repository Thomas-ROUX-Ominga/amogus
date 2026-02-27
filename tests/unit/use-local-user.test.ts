import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useLocalUser } from "@/hooks/use-local-user";

const STORAGE_KEY = "amogus_user_id";

describe("useLocalUser", () => {
    beforeEach(() => {
        localStorage.clear();
        vi.clearAllMocks();
    });

    it("should generate a new userId if none exists in localStorage", async () => {
        const { result } = renderHook(() => useLocalUser());

        // Wait for useEffect to complete
        await waitFor(() => {
            expect(result.current.userId).toBeDefined();
            expect(typeof result.current.userId).toBe("string");
        });
        
        expect(localStorage.getItem(STORAGE_KEY)).toBe(result.current.userId);
    });

    it("should retrieve an existing userId from localStorage", async () => {
        const existingId = "existing-test-uuid";
        localStorage.setItem(STORAGE_KEY, existingId);

        const { result } = renderHook(() => useLocalUser());

        await waitFor(() => {
            expect(result.current.userId).toBe(existingId);
        });
    });

    it("should persist the same userId across multiple calls", async () => {
        const { result: firstResult } = renderHook(() => useLocalUser());
        
        await waitFor(() => {
            expect(firstResult.current.userId).toBeDefined();
        });
        
        const firstId = firstResult.current.userId;

        const { result: secondResult } = renderHook(() => useLocalUser());
        
        await waitFor(() => {
            expect(secondResult.current.userId).toBe(firstId);
        });
    });

    it("should fallback to a generated ID if localStorage is restricted", async () => {
        const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => { });
        
        // Mock both getItem and setItem to throw errors
        const getItemSpy = vi.spyOn(localStorage, 'getItem').mockImplementation(() => {
            throw new Error("SecurityError: The operation is insecure.");
        });
        const setItemSpy = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
            throw new Error("SecurityError: The operation is insecure.");
        });

        const { result } = renderHook(() => useLocalUser());

        await waitFor(() => {
            expect(result.current.userId).toBeDefined();
            expect(typeof result.current.userId).toBe("string");
        });
        
        expect(consoleSpy).toHaveBeenCalled();

        getItemSpy.mockRestore();
        setItemSpy.mockRestore();
        consoleSpy.mockRestore();
    });
});
