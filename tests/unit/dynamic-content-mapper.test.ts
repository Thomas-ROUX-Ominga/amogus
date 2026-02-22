import { describe, it, expect, vi, beforeEach } from "vitest";
import { DynamicContentMapper } from "@/lib/quests/dynamic-content-mapper";
import { getQuestMetadata, getPlayerFailedQuests } from "@/lib/redis/actions";
import { getQuestGamesByDuration } from "@/lib/constants/quest-pool";
import { Quest, QuestGame, QuestType, QuestDuration } from "@/types/quest";

// Mock dependencies
vi.mock("@/lib/redis/actions");
vi.mock("@/lib/constants/quest-pool");

const mockGetQuestMetadata = vi.mocked(getQuestMetadata);
const mockGetPlayerFailedQuests = vi.mocked(getPlayerFailedQuests);
const mockGetQuestGamesByDuration = vi.mocked(getQuestGamesByDuration);

describe("DynamicContentMapper", () => {
    const mockQuestId = "quest-123";
    const mockGameId = "game-456";
    const mockUserId = "user-789";

    const mockQuestMetadata: Quest = {
        id: mockQuestId,
        type: "true-false" as QuestType,
        duration: "short" as QuestDuration,
        location: "Test Location"
    };

    const mockQuestGames: QuestGame[] = [
        {
            id: "content-1",
            type: "true-false" as QuestType,
            duration: "short" as QuestDuration,
            title: "Test Question 1",
            instruction: "Is this a test?",
            answer: "true"
        },
        {
            id: "content-2",
            type: "true-false" as QuestType,
            duration: "short" as QuestDuration,
            title: "Test Question 2",
            instruction: "Is this another test?",
            answer: "false"
        },
        {
            id: "content-3",
            type: "qcm" as QuestType,
            duration: "short" as QuestDuration,
            title: "Test QCM",
            instruction: "Choose an option",
            options: [
                { label: "Option 1", value: "opt1" },
                { label: "Option 2", value: "opt2" }
            ],
            answer: "opt1"
        }
    ];

    beforeEach(() => {
        vi.clearAllMocks();
        mockGetQuestGamesByDuration.mockReturnValue(mockQuestGames);
    });

    describe("getQuestContent", () => {
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
            expect(result!.contentId).not.toBe("content-1"); // Should exclude failed content
            expect(result!.isRotation).toBe(true);
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
                    [mockQuestId]: ["content-1", "content-2"] // Player failed all true-false content
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
            // isRotation is false because when all content is exhausted, we fallback to any content
            // which will be in the failed list, so rotation logic returns false
            expect(result!.isRotation).toBe(false);
        });

        it("should return null when no content matches type and duration", async () => {
            // Arrange
            mockGetQuestMetadata.mockResolvedValue({
                success: true,
                data: {
                    ...mockQuestMetadata,
                    type: "form" as QuestType // No form content in mock data
                }
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
            expect(result).toBeNull();
        });
    });

    describe("hasPlayerFailedQuest", () => {
        it("should return true when player has failed the quest", async () => {
            // Arrange
            mockGetPlayerFailedQuests.mockResolvedValue({
                success: true,
                data: {
                    [mockQuestId]: ["content-1"]
                }
            });

            // Act
            const result = await DynamicContentMapper.hasPlayerFailedQuest(
                mockGameId,
                mockUserId,
                mockQuestId
            );

            // Assert
            expect(result).toBe(true);
        });

        it("should return false when player has not failed the quest", async () => {
            // Arrange
            mockGetPlayerFailedQuests.mockResolvedValue({
                success: true,
                data: {}
            });

            // Act
            const result = await DynamicContentMapper.hasPlayerFailedQuest(
                mockGameId,
                mockUserId,
                mockQuestId
            );

            // Assert
            expect(result).toBe(false);
        });

        it("should return false when failed quests data is unavailable", async () => {
            // Arrange
            mockGetPlayerFailedQuests.mockResolvedValue({
                success: false,
                error: "Failed to load data"
            });

            // Act
            const result = await DynamicContentMapper.hasPlayerFailedQuest(
                mockGameId,
                mockUserId,
                mockQuestId
            );

            // Assert
            expect(result).toBe(false);
        });
    });

    describe("getFailedAttemptCount", () => {
        it("should return the correct count of failed attempts", async () => {
            // Arrange
            mockGetPlayerFailedQuests.mockResolvedValue({
                success: true,
                data: {
                    [mockQuestId]: ["content-1", "content-2", "content-3"]
                }
            });

            // Act
            const result = await DynamicContentMapper.getFailedAttemptCount(
                mockGameId,
                mockUserId,
                mockQuestId
            );

            // Assert
            expect(result).toBe(3);
        });

        it("should return 0 when player has not failed the quest", async () => {
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
        });
    });

    describe("selectContentWithRotation", () => {
        it("should use cryptographically secure random selection", async () => {
            // Arrange
            const cryptoSpy = vi.spyOn(crypto, 'getRandomValues');
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
            expect(cryptoSpy).toHaveBeenCalled();
            cryptoSpy.mockRestore();
        });
    });
});
