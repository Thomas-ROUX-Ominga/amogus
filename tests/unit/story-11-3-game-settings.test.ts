import { vi, describe, it, expect, beforeEach } from "vitest";
import { joinGame, createGame } from "@/lib/redis/actions";
import { redis } from "@/lib/redis/client";
import { getBatch } from "@/lib/redis/batch-actions";
import { Quest, QuestType, QuestDuration } from "@/types/quest";

// Mock dependencies
vi.mock("@/lib/redis/client", () => ({
    redis: {
        set: vi.fn(),
        get: vi.fn(),
        atomicUpdate: vi.fn(),
    },
}));

vi.mock("@/lib/redis/batch-actions", () => ({
    getBatch: vi.fn(),
}));

// Valid UUID v4 for testing
const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000";

describe("Story 11.3: Game Settings from Batch", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("Task 3: Automatic Assignment on Join", () => {
        it("should assign quests to new players when joining a game with batch configuration", async () => {
            // Mock game state with quest configuration
            const mockGameState = {
                id: "test-game",
                status: "LOBBY",
                players: [],
                createdAt: Date.now(),
                batchId: "test-batch",
                questsPerPlayer: { short: 2, medium: 1, long: 1 },
            };

            // Mock batch data with proper Quest types
            const mockBatch = {
                id: "test-batch",
                questCount: 4,
                createdAt: new Date().toISOString(),
                quests: [
                    { id: "quest-1", type: "true-false" as QuestType, duration: "short" as QuestDuration },
                    { id: "quest-2", type: "qcm" as QuestType, duration: "short" as QuestDuration },
                    { id: "quest-3", type: "true-false" as QuestType, duration: "medium" as QuestDuration },
                    { id: "quest-4", type: "qcm" as QuestType, duration: "long" as QuestDuration },
                ],
            };

            vi.mocked(redis.get).mockResolvedValueOnce(mockGameState);
            vi.mocked(getBatch).mockResolvedValueOnce({
                success: true,
                data: mockBatch,
            });
            vi.mocked(redis.set).mockResolvedValueOnce(undefined);

            const result = await joinGame("test-game", "TestPlayer", VALID_UUID);

            expect(result.success).toBe(true);
            expect(result.data?.players).toHaveLength(1);
            
            const player = result.data?.players[0];
            if (player) {
                expect(player.assignedQuests).toBeDefined();
                expect(player.assignedQuests?.length).toBe(4); // 2 short + 1 medium + 1 long
                expect(player.assignedQuests).toContain("quest-1");
                expect(player.assignedQuests).toContain("quest-2");
                expect(player.assignedQuests).toContain("quest-3");
                expect(player.assignedQuests).toContain("quest-4");
            }
        });

        it("should not assign quests when game has no batch configuration", async () => {
            // Mock game state without batch configuration
            const mockGameState = {
                id: "test-game",
                status: "LOBBY",
                players: [],
                createdAt: Date.now(),
            };

            vi.mocked(redis.get).mockResolvedValueOnce(mockGameState);
            vi.mocked(redis.set).mockResolvedValueOnce(undefined);

            const result = await joinGame("test-game", "TestPlayer", VALID_UUID);

            expect(result.success).toBe(true);
            expect(result.data?.players).toHaveLength(1);
            
            const player = result.data?.players[0];
            if (player) {
                expect(player.assignedQuests).toBeUndefined();
            }
        });

        it("should handle batch loading failure gracefully by failing joining", async () => {
            // Mock game state with batch configuration
            const mockGameState = {
                id: "test-game",
                status: "LOBBY",
                players: [],
                createdAt: Date.now(),
                batchId: "test-batch",
                questsPerPlayer: { short: 1, medium: 1, long: 1 },
            };

            vi.mocked(redis.get).mockResolvedValueOnce(mockGameState);
            vi.mocked(getBatch).mockResolvedValueOnce({
                success: false,
                error: "Batch not found",
            });

            const result = await joinGame("test-game", "TestPlayer", VALID_UUID);

            expect(result.success).toBe(false);
            expect(result.error).toContain("Failed to assign quests");
        });
    });

    describe("Quest Assignment Validation", () => {
        it("should validate quest completion against assigned quests", async () => {
            // This would be tested in the completeQuest function
            // For now, we'll test the joinGame assignment logic
            const mockGameState = {
                id: "test-game",
                status: "IN_PROGRESS",
                players: [{
                    id: VALID_UUID,
                    name: "TestPlayer",
                    isAlive: true,
                    assignedQuests: ["quest-1", "quest-2"],
                    completedQuests: [],
                }],
                createdAt: Date.now(),
                batchId: "test-batch",
                questsPerPlayer: { short: 2, medium: 0, long: 0 },
            };

            vi.mocked(redis.get).mockResolvedValueOnce(mockGameState);

            const result = await joinGame("test-game", "TestPlayer", VALID_UUID);

            expect(result.success).toBe(true); // Player already exists, should return success
            const player = result.data?.players[0];
            if (player) {
                expect(player.assignedQuests).toEqual(["quest-1", "quest-2"]);
            }
        });
    });
});
