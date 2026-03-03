import { DynamicContentMapper } from "@/lib/quests/dynamic-content-mapper";
import { getGame, getQuestMetadata, getPlayerFailedQuests } from "@/lib/redis/actions";
import { getQuestGamesByDuration } from "@/lib/constants/quest-pool";
import { Quest, QuestDuration, QuestGame, QuestType } from "@/types/quest";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock dependencies
vi.mock("@/lib/redis/actions");
vi.mock("@/lib/constants/quest-pool");

const mockGetGame = vi.mocked(getGame);
const mockGetQuestMetadata = vi.mocked(getQuestMetadata);
const mockGetPlayerFailedQuests = vi.mocked(getPlayerFailedQuests);
const mockGetQuestGamesByDuration = vi.mocked(getQuestGamesByDuration);

const mockQuestId = "quest-123";
const mockGameId = "game-456";
const mockUserId = "user-impostor";
const mockQuestMetadata: Quest = {
    id: mockQuestId,
    type: "true-false" as QuestType,
    duration: "short" as QuestDuration,
    location: "Test Location"
};

const mockQuestGames: QuestGame[] = [
    {
        id: "content-1",
        type: "true-false",
        duration: "short",
        title: "Test Question 1",
        instruction: "Is this a test?",
        data: {
            choices: [
                { id: "opt1", label: "Option 1" },
                { id: "opt2", label: "Option 2" }
            ],
            answerIds: ["opt1"]
        }
    } as Extract<QuestGame, { type: "true-false" }>,
    {
        id: "content-2",
        type: "true-false",
        duration: "short",
        title: "Test Question 2",
        instruction: "Is this another test?",
        data: {
            choices: [
                { id: "opt1", label: "Option 1" },
                { id: "opt2", label: "Option 2" }
            ],
            answerIds: ["opt2"]
        }
    } as Extract<QuestGame, { type: "true-false" }>,
    {
        id: "content-3",
        type: "qcm",
        duration: "short",
        title: "Test QCM",
        instruction: "Choose an option",
        data: {
            mode: "single",
            choices: [
                { id: "optA", label: "Option A" },
                { id: "optB", label: "Option B" }
            ],
            answerIds: ["optA"]
        }
    } as Extract<QuestGame, { type: "qcm" }>
];

describe("DynamicContentMapper", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetQuestGamesByDuration.mockReturnValue(mockQuestGames);
        mockGetQuestMetadata.mockResolvedValue({
            success: true,
            data: mockQuestMetadata
        });
        mockGetPlayerFailedQuests.mockResolvedValue({
            success: true,
            data: {}
        });
        // Mock game state with non-impostor player by default
        mockGetGame.mockResolvedValue({
            success: true,
            data: {
                id: mockGameId,
                status: "IN_PROGRESS",
                players: [
                    {
                        id: mockUserId,
                        name: "Test Player",
                        isAlive: true,
                        role: "CREWMATE"
                    }
                ],
                createdAt: Date.now(),
                questsTotal: 10,
                questsPerPlayer: { short: 1, medium: 1, long: 1 }
            }
        });
    });

    describe("getQuestContent", () => {
        it("should return null immediately for impostor users", async () => {
            // Arrange - Mock game state with impostor player
            mockGetGame.mockResolvedValue({
                success: true,
                data: {
                    id: mockGameId,
                    status: "IN_PROGRESS",
                    players: [
                        {
                            id: mockUserId,
                            name: "Impostor Player",
                            isAlive: true,
                            role: "IMPOSTOR"
                        }
                    ],
                    createdAt: Date.now(),
                    questsTotal: 10,
                    questsPerPlayer: { short: 1, medium: 1, long: 1 }
                }
            });

            // Act
            const result = await DynamicContentMapper.getQuestContent(
                mockQuestId,
                mockGameId,
                mockUserId
            );

            // Assert
            expect(result).toBeNull();
            // Should not attempt to load metadata or failed quests for impostors
            expect(mockGetQuestMetadata).not.toHaveBeenCalled();
            expect(mockGetPlayerFailedQuests).not.toHaveBeenCalled();
        });

        it("should return content when quest metadata exists and no failed quests", async () => {
            // Arrange
            mockGetQuestMetadata.mockResolvedValue({
                success: true,
                data: mockQuestMetadata
            });
            mockGetPlayerFailedQuests.mockResolvedValue({
                success: true,
                data: {}
            });

            // Act
            const result = await DynamicContentMapper.getQuestContent(
                mockQuestId,
                mockGameId,
                mockUserId
            );

            // Assert
            expect(result).not.toBeNull();
            expect(result!.content.type).toBe("true-false");
            expect(result!.content.duration).toBe("short");
            expect(result!.contentId).toBeDefined();
            expect(result!.isRotation).toBe(false);
            expect(mockGetQuestMetadata).toHaveBeenCalledWith(mockQuestId, mockGameId);
            expect(mockGetPlayerFailedQuests).toHaveBeenCalledWith(mockGameId, mockUserId);
        });

        it("should return rotated content when player has failed quests", async () => {
            // Arrange
            mockGetQuestMetadata.mockResolvedValue({
                success: true,
                data: mockQuestMetadata
            });
            mockGetPlayerFailedQuests.mockResolvedValue({
                success: true,
                data: {
                    [mockQuestId]: ["content-1"] // Player failed content-1 before
                }
            });

            // Act
            const result = await DynamicContentMapper.getQuestContent(
                mockQuestId,
                mockGameId,
                mockUserId
            );

            // Assert
            expect(result).not.toBeNull();
            expect(result!.content.type).toBe("true-false");
            expect(result!.content.duration).toBe("short");
            expect(result!.contentId).toBeDefined();
            expect(result!.isRotation).toBe(true);
            expect(mockGetQuestMetadata).toHaveBeenCalledWith(mockQuestId, mockGameId);
            expect(mockGetPlayerFailedQuests).toHaveBeenCalledWith(mockGameId, mockUserId);
        });

        it("should return null when quest metadata not found", async () => {
            // Arrange
            mockGetQuestMetadata.mockResolvedValue({
                success: false,
                error: "Quest not found",
                code: "ERR_NOT_FOUND"
            });

            // Act
            const result = await DynamicContentMapper.getQuestContent(
                mockQuestId,
                mockGameId,
                mockUserId
            );

            // Assert
            expect(result).toBeNull();
            expect(mockGetQuestMetadata).toHaveBeenCalledWith(mockQuestId, mockGameId);
        });

        it("should return fallback content when all content has been tried", async () => {
            // Arrange
            mockGetQuestMetadata.mockResolvedValue({
                success: true,
                data: mockQuestMetadata
            });
            mockGetPlayerFailedQuests.mockResolvedValue({
                success: true,
                data: {
                    [mockQuestId]: ["content-1", "content-2", "content-3"] // Player failed all true-false content
                }
            });

            // Act
            const result = await DynamicContentMapper.getQuestContent(
                mockQuestId,
                mockGameId,
                mockUserId
            );

            // Assert
            expect(result).not.toBeNull();
            expect(result!.content.type).toBe("true-false");
            expect(result!.content.duration).toBe("short");
            expect(result!.contentId).toBeDefined();
            expect(result!.isRotation).toBe(false);
            expect(mockGetQuestMetadata).toHaveBeenCalledWith(mockQuestId, mockGameId);
            expect(mockGetPlayerFailedQuests).toHaveBeenCalledWith(mockGameId, mockUserId);
        });

        it("should return null when no content matches type and duration", async () => {
            // Arrange
            mockGetQuestMetadata.mockResolvedValue({
                success: true,
                data: {
                    ...mockQuestMetadata,
                    type: "single-input" as QuestType // No single-input content in mock data
                }
            });

            // Act
            const result = await DynamicContentMapper.getQuestContent(
                mockQuestId,
                mockGameId,
                mockUserId
            );

            // Assert
            expect(result).toBeNull();
            expect(mockGetQuestMetadata).toHaveBeenCalledWith(mockQuestId, mockGameId);
        });

        it("should return 0 when player has not failed quests", async () => {
            // Arrange
            mockGetPlayerFailedQuests.mockResolvedValue({
                success: true,
                data: {}
            });

            // Act
            const result = await DynamicContentMapper.getFailedAttemptCount(
                mockGameId,
                mockUserId,
                mockQuestId
            );

            // Assert
            expect(result).toBe(0);
            expect(mockGetPlayerFailedQuests).toHaveBeenCalledWith(mockGameId, mockUserId);
        });

        it("should return 0 when failed quests data is unavailable", async () => {
            // Arrange
            mockGetPlayerFailedQuests.mockResolvedValue({
                success: false,
                error: "Failed to load data"
            });

            // Act
            const result = await DynamicContentMapper.getFailedAttemptCount(
                mockGameId,
                mockUserId,
                mockQuestId
            );

            // Assert
            expect(result).toBe(0);
            expect(mockGetPlayerFailedQuests).toHaveBeenCalledWith(mockGameId, mockUserId);
        });

        it("should use cryptographically secure random selection", async () => {
            // Arrange
            const mockGetRandomValues = vi.fn().mockReturnValue(new Uint32Array([42]));
            
            // Mock crypto using Object.defineProperty to avoid read-only issues
            const originalCrypto = globalThis.crypto;
            const mockCrypto = { getRandomValues: mockGetRandomValues };
            
            Object.defineProperty(globalThis, 'crypto', {
                value: mockCrypto,
                writable: true,
                configurable: true
            });
            
            mockGetQuestMetadata.mockResolvedValue({
                success: true,
                data: mockQuestMetadata
            });
            mockGetPlayerFailedQuests.mockResolvedValue({
                success: true,
                data: {}
            });

            // Act
            await DynamicContentMapper.getQuestContent(
                mockQuestId,
                mockGameId,
                mockUserId
            );

            // Assert
            expect(mockGetRandomValues).toHaveBeenCalled();
            
            // Restore original crypto
            Object.defineProperty(globalThis, 'crypto', {
                value: originalCrypto,
                writable: true,
                configurable: true
            });
        });
    });
});
