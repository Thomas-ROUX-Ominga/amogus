import { beforeEach, describe, expect, it, vi } from "vitest";
import { GameState } from "@/types/game";

let sharedState: GameState | null = null;

vi.mock("@/lib/redis/client", () => ({
    GAME_TTL_SECONDS: 86400,
    redis: {
        get: vi.fn(async () => (sharedState ? structuredClone(sharedState) : null)),
        atomicUpdate: vi.fn(async (_key: string, updater: (current: GameState | null) => GameState | null) => {
            const next = updater(sharedState ? structuredClone(sharedState) : null);
            if (next) {
                sharedState = structuredClone(next);
                return structuredClone(next);
            }
            return sharedState ? structuredClone(sharedState) : null;
        }),
    },
}));

vi.mock("@/lib/redis/auth-utils", () => ({
    createPlayerSession: vi.fn(() => Promise.resolve({ success: true })),
    verifyPlayerSession: vi.fn(() => Promise.resolve({ success: true })),
    verifySession: vi.fn(() => Promise.resolve({ success: true })),
}));

import { joinGame } from "@/lib/redis/actions";

describe("joinGame concurrency", () => {
    beforeEach(() => {
        const now = Date.now();
        sharedState = {
            id: "CONCURRENT",
            status: "LOBBY",
            players: [{ id: "admin-1", name: "Admin", isAlive: true }],
            createdAt: now,
            revision: 1,
            updatedAt: now,
            creatorId: "admin-1",
        };
    });

    it("keeps all players after concurrent joins", async () => {
        const joins = Array.from({ length: 8 }, (_, index) =>
            joinGame("CONCURRENT", `Player ${index + 1}`, `user-${index + 1}-abcde`)
        );

        const results = await Promise.all(joins);
        expect(results.every((result) => result.success)).toBe(true);

        const finalState = sharedState!;
        const uniqueIds = new Set(finalState.players.map((player) => player.id));
        expect(uniqueIds.size).toBe(9); // admin + 8 joined players
        expect(finalState.players).toHaveLength(9);
    });

    it("remains idempotent for duplicate concurrent joins", async () => {
        const joins = Array.from({ length: 5 }, () =>
            joinGame("CONCURRENT", "Duplicate", "user-duplicate-abcde")
        );

        const results = await Promise.all(joins);
        expect(results.every((result) => result.success)).toBe(true);

        const finalState = sharedState!;
        const duplicates = finalState.players.filter((player) => player.id === "user-duplicate-abcde");
        expect(duplicates).toHaveLength(1);
    });
});
