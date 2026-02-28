import { vi, describe, it, expect, beforeEach } from "vitest";
import { joinGame, createGame, completeQuest } from "@/lib/redis/actions";
import { redis } from "@/lib/redis/client";
import { getBatch, getBatchData } from "@/lib/redis/batch-actions";
import { Quest, QuestType, QuestDuration } from "@/types/quest";

// Mock dependencies
vi.mock("@/lib/redis/client", () => ({
    redis: {
        set: vi.fn(),
        get: vi.fn(),
        atomicUpdate: vi.fn(),
    },
    GAME_TTL_SECONDS: 86400,
}));

vi.mock("@/lib/redis/batch-actions", () => ({
    getBatchData: vi.fn(),
}));

vi.mock("@/lib/redis/auth-utils", () => ({
    verifySession: vi.fn().mockResolvedValue({ success: true, data: { userId: "admin", username: "admin" } }),
    createPlayerSession: vi.fn().mockResolvedValue({ success: true }),
    verifyPlayerSession: vi.fn().mockResolvedValue({ success: true }),
}));

// Valid UUID v4 for testing
const VALID_UUID = "user-12345";

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
            vi.mocked(getBatchData).mockResolvedValueOnce({
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
            vi.mocked(getBatchData).mockResolvedValueOnce({
                success: false,
                error: "Batch not found",
            });

            const result = await joinGame("test-game", "TestPlayer", VALID_UUID);

            expect(result.success).toBe(false);
            expect(result.error).toContain("Failed to assign quests");
        });

        it("should throw error if batch has insufficient quests for duration", async () => {
            const mockGameState = {
                id: "test-game",
                status: "LOBBY",
                players: [],
                createdAt: Date.now(),
                batchId: "test-batch",
                questsPerPlayer: { short: 10, medium: 0, long: 0 }, // 10 short requested, only 2 exist
            };

            const mockBatch = {
                id: "test-batch",
                questCount: 2,
                createdAt: new Date().toISOString(),
                quests: [
                    { id: "q1", type: "true-false" as QuestType, duration: "short" as QuestDuration },
                    { id: "q2", type: "true-false" as QuestType, duration: "short" as QuestDuration },
                ],
            };

            vi.mocked(redis.get).mockResolvedValueOnce(mockGameState);
            vi.mocked(getBatchData).mockResolvedValueOnce({ success: true, data: mockBatch as typeof mockBatch });

            const result = await joinGame("test-game", "Test", VALID_UUID);
            expect(result.success).toBe(false);
            expect(result.error).toContain("Failed to assign quests");
        });
    });

    describe("Quest Assignment Validation", () => {
        it("should block quest completion if not assigned to player when game has batch", async () => {
            const mockGameState = {
                id: "test-game",
                status: "IN_PROGRESS",
                batchId: "test-batch",
                players: [{
                    id: VALID_UUID,
                    name: "TestPlayer",
                    isAlive: true,
                    assignedQuests: ["quest-1"],
                }],
            };

            vi.mocked(redis.get).mockResolvedValueOnce(mockGameState);
            vi.mocked(redis.atomicUpdate).mockImplementationOnce(async (key, updater) => {
                console.log("Updater input:", JSON.stringify(mockGameState));
                const updated = updater(mockGameState as typeof mockGameState);
                console.log("Updater output:", JSON.stringify(updated));
                return updated;
            });

            const result = await completeQuest("test-game", VALID_UUID, "quest-2");
            expect(result.success).toBe(false);
            expect(result.error).toContain("not assigned to you");
        });

        it("should allow quest completion if assigned to player", async () => {
            const mockGameState = {
                id: "test-game",
                status: "IN_PROGRESS",
                batchId: "test-batch",
                players: [{
                    id: VALID_UUID,
                    name: "TestPlayer",
                    isAlive: true,
                    assignedQuests: ["quest-1"],
                    completedQuests: [],
                }],
            };

            vi.mocked(redis.get).mockResolvedValueOnce(mockGameState);
            vi.mocked(redis.atomicUpdate).mockImplementationOnce(async (key, updater) => {
                const updated = updater(mockGameState as typeof mockGameState);
                return updated;
            });

            const result = await completeQuest("test-game", VALID_UUID, "quest-1");
            expect(result.success).toBe(true);
            expect(result.data?.questsCompleted).toBe(1);
        });
    });
});
