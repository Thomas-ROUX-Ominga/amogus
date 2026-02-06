import { vi, describe, it, expect, beforeEach } from "vitest";
import { joinGame } from "@/lib/kv/actions";
import { kv } from "@/lib/kv/client";

// Mock kv client
vi.mock("@/lib/kv/client", () => ({
    kv: {
        set: vi.fn(),
        get: vi.fn(),
    },
}));

// Valid UUID v4 for testing
const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000";

describe("joinGame", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("should successfully add a player to an existing game", async () => {
        const mockState = {
            id: "test-game",
            status: "LOBBY",
            players: [],
            createdAt: Date.now(),
        };
        (kv.get as any).mockResolvedValueOnce(mockState);

        const result = await joinGame("test-game", "Omi", VALID_UUID);

        expect(result.success).toBe(true);
        expect(result.data?.players).toHaveLength(1);
        expect(result.data?.players[0]).toEqual({
            id: VALID_UUID,
            name: "Omi",
            isAlive: true,
        });
        expect(kv.set).toHaveBeenCalled();
    });

    it("should not add a player if they are already in the game", async () => {
        const mockState = {
            id: "test-game",
            status: "LOBBY",
            players: [{ id: VALID_UUID, name: "Omi", isAlive: true }],
            createdAt: Date.now(),
        };
        (kv.get as any).mockResolvedValueOnce(mockState);

        const result = await joinGame("test-game", "Omi-Duplicate", VALID_UUID);

        expect(result.success).toBe(true);
        expect(result.data?.players).toHaveLength(1);
        expect(kv.set).not.toHaveBeenCalled();
    });

    it("should return error if game does not exist", async () => {
        (kv.get as any).mockResolvedValueOnce(null);

        const result = await joinGame("invalid-game", "Omi", VALID_UUID);

        expect(result.success).toBe(false);
        expect(result.error).toContain("not found");
    });

    it("should return error for invalid UUID signature", async () => {
        const result = await joinGame("test-game", "Omi", "invalid-id");
        expect(result.success).toBe(false);
        expect(result.error).toContain("Invalid crew signature");
    });
});
