import { describe, it, expect } from "vitest";
import { getTotalQuests, calculateGlobalProgress, calculatePlayerProgress } from "@/lib/utils/quest-calculations";
import { GameState } from "@/types/game";

describe("quest-calculations", () => {
    const mockGameState: GameState = {
        id: "test-game",
        status: "IN_PROGRESS",
        players: [],
        createdAt: Date.now(),
        questsPerPlayer: {
            short: 1,
            medium: 1,
            long: 1
        }
    };

    describe("getTotalQuests", () => {
        it("should return the sum of questsPerPlayer when gameState is provided", () => {
            const total = getTotalQuests(mockGameState);
            expect(total).toBe(3);
        });

        it("should return different sum for different configuration", () => {
            const customGameState = {
                ...mockGameState,
                questsPerPlayer: { short: 2, medium: 2, long: 2 }
            };
            const total = getTotalQuests(customGameState);
            expect(total).toBe(6);
        });

        it("should fallback to pool size when no gameState or configuration provided", () => {
            const total = getTotalQuests(null);
            // Assuming the pool has some quests, it should be > 0
            expect(total).toBeGreaterThan(0);
        });
    });

    describe("calculateGlobalProgress", () => {
        it("should calculate correctly based on questsPerPlayer", () => {
            const players = [
                { completedQuests: ["q1"] }, // 1/3
                { completedQuests: ["q1", "q2"] } // 2/3
            ];
            // Total completed: 3
            // Total possible: 2 players * 3 quests/player = 6
            // Progress: 50%
            const progress = calculateGlobalProgress(players, mockGameState);
            expect(progress).toBe(50);
        });
    });

    describe("calculatePlayerProgress", () => {
        it("should calculate correctly based on questsPerPlayer", () => {
            const completedQuests = ["q1", "q2"]; // 2/3 = 66.66...%
            const progress = calculatePlayerProgress(completedQuests, mockGameState);
            expect(progress).toBeCloseTo(66.66, 1);
        });
    });
});
