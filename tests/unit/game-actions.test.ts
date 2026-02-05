import { vi, describe, it, expect, beforeEach } from "vitest";
import { createGame } from "@/lib/kv/actions";
import { kv } from "@/lib/kv/client";

// Mock kv client
vi.mock("@/lib/kv/client", () => ({
    kv: {
        set: vi.fn(),
    },
}));

// Mock uuid
vi.mock("uuid", () => ({
    v4: () => "test-uuid",
}));

// Mock next/navigation
vi.mock("next/navigation", () => ({
    redirect: vi.fn(),
}));

describe("createGame", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("should create a game and store it in KV", async () => {
        const result = await createGame();

        expect(result.success).toBe(true);
        expect(result.data).toBe("test-uuid");
        expect(kv.set).toHaveBeenCalledWith(
            "game:test-uuid:state",
            expect.objectContaining({
                id: "test-uuid",
                status: "LOBBY",
                players: [],
            })
        );
    });

    it("should return failure if KV fails", async () => {
        (kv.set as any).mockRejectedValueOnce(new Error("KV Error"));

        const result = await createGame();

        expect(result.success).toBe(false);
        expect(result.error).toContain("Failed to create game");
    });
});
