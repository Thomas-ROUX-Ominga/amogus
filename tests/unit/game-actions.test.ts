import { vi, describe, it, expect, beforeEach } from "vitest";
import { createGame, getGame } from "@/lib/kv/actions";
import { kv } from "@/lib/kv/client";

// Mock kv client
vi.mock("@/lib/kv/client", () => ({
    kv: {
        set: vi.fn(),
        get: vi.fn(),
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
        (kv.set as unknown as { mockRejectedValueOnce: (val: Error) => void }).mockRejectedValueOnce(new Error("KV Error"));

        const result = await createGame();

        expect(result.success).toBe(false);
        expect(result.error).toContain("Failed to create game");
    });
});

describe("getGame", () => {
    // getGame is already imported at the top

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("should return game state if found", async () => {
        const mockState = { id: "test-id", status: "LOBBY", players: [] };
        (kv.get as any).mockResolvedValueOnce(mockState);

        const result = await getGame("test-id");

        expect(result.success).toBe(true);
        expect(result.data).toEqual(mockState);
        expect(kv.get).toHaveBeenCalledWith("game:test-id:state");
    });

    it("should return failure if game not found", async () => {
        (kv.get as any).mockResolvedValueOnce(null);

        const result = await getGame("test-id");

        expect(result.success).toBe(false);
        expect(result.error).toContain("not found");
    });

    it("should return failure if KV fails", async () => {
        (kv.get as any).mockRejectedValueOnce(new Error("KV Error"));

        const result = await getGame("test-id");

        expect(result.success).toBe(false);
        expect(result.error).toContain("Failed to establish link");
    });
});
