import { describe, it, expect, vi, beforeEach } from "vitest";
import { 
    getRandomQuestGameWithExclusion, 
    getSecureRandomQuestGameWithExclusion 
} from "@/lib/constants/quest-pool";
import { getQuestGamesByDuration } from "@/lib/constants/quest-pool";
import { QuestGame, QuestType, QuestDuration } from "@/types/quest";

// Mock dependencies
vi.mock("@/lib/constants/quest-pool", async () => {
    const actual = await vi.importActual("@/lib/constants/quest-pool");
    return {
        ...actual,
        getQuestGamesByDuration: vi.fn()
    };
});

const mockGetQuestGamesByDuration = vi.mocked(getQuestGamesByDuration);

describe("Quest Pool Dynamic Functions", () => {
    const mockQuestGames: QuestGame[] = [
        {
            id: "content-1",
            type: "true-false",
            duration: "short",
            title: "Test Question 1",
            instruction: "Is this a test?",
            data: { choices: [], answerIds: ["true"] }
        } as Extract<QuestGame, { type: "true-false" }>,
        {
            id: "content-2",
            type: "true-false",
            duration: "short",
            title: "Test Question 2",
            instruction: "Is this another test?",
            data: { choices: [], answerIds: ["false"] }
        } as Extract<QuestGame, { type: "true-false" }>,
        {
            id: "content-3",
            type: "qcm",
            duration: "short",
            title: "Test QCM",
            instruction: "Choose an option",
            data: { mode: "single", choices: [], answerIds: ["opt1"] }
        } as Extract<QuestGame, { type: "qcm" }>
    ];

    beforeEach(() => {
        vi.clearAllMocks();
        mockGetQuestGamesByDuration.mockReturnValue(mockQuestGames);
    });

    describe("getRandomQuestGameWithExclusion", () => {
        it("should return a quest game not in exclusion list", () => {
            // Arrange
            const excludedIds = ["content-1"];

            // Act
            const result = getRandomQuestGameWithExclusion(
                "true-false",
                "short",
                excludedIds
            );

            // Assert
            expect(result).not.toBeNull();
            expect(result!.type).toBe("true-false");
            expect(result!.duration).toBe("short");
            expect(excludedIds).not.toContain(result!.id);
        });

        it("should return fallback when all content is excluded", () => {
            // Arrange
            const excludedIds: string[] = ["content-1", "content-2"]; // All true-false content excluded

            // Act
            const result = getRandomQuestGameWithExclusion(
                "true-false",
                "short",
                excludedIds
            );

            // Assert
            expect(result).not.toBeNull();
            expect(result!.type).toBe("true-false");
            expect(result!.duration).toBe("short");
            // Should return any true-false content despite exclusion
        });

        it("should return null when no content matches type", () => {
            // Arrange
            const excludedIds: string[] = [];

            // Act
            const result = getRandomQuestGameWithExclusion(
                "form" as any, // Unsupported type
                "short",
                []
            );

            // Assert
            expect(result).toBeNull();
        });

        it("should handle empty exclusion list", () => {
            // Arrange
            const excludedIds: string[] = [];

            // Act
            const result = getRandomQuestGameWithExclusion(
                "true-false",
                "short",
                excludedIds
            );

            // Assert
            expect(result).not.toBeNull();
            expect(result!.type).toBe("true-false");
            expect(result!.duration).toBe("short");
        });
    });

    describe("getSecureRandomQuestGameWithExclusion", () => {
        it("should use cryptographically secure random selection", () => {
            // Arrange
            const cryptoSpy = vi.spyOn(crypto, 'getRandomValues');
            const excludedIds = ["content-1"];

            // Act
            const result = getSecureRandomQuestGameWithExclusion(
                "true-false",
                "short",
                excludedIds
            );

            // Assert
            expect(result).not.toBeNull();
            expect(result!.type).toBe("true-false");
            expect(result!.duration).toBe("short");
            expect(excludedIds).not.toContain(result!.id);
            expect(cryptoSpy).toHaveBeenCalled();
            cryptoSpy.mockRestore();
        });

        it("should return fallback when all content is excluded", () => {
            // Arrange
            const cryptoSpy = vi.spyOn(crypto, 'getRandomValues');
            const excludedIds = ["content-1", "content-2"]; // All true-false content excluded

            // Act
            const result = getSecureRandomQuestGameWithExclusion(
                "true-false",
                "short",
                excludedIds
            );

            // Assert
            expect(result).not.toBeNull();
            expect(result!.type).toBe("true-false");
            expect(result!.duration).toBe("short");
            expect(cryptoSpy).toHaveBeenCalled();
            cryptoSpy.mockRestore();
        });

        it("should return null when no content matches type", () => {
            // Arrange
            const excludedIds: string[] = [];

            // Act
            const result = getSecureRandomQuestGameWithExclusion(
                "form" as any, // Unsupported type
                "short",
                []
            );

            // Assert
            expect(result).toBeNull();
        });

        it("should handle empty exclusion list with secure random", () => {
            // Arrange
            const cryptoSpy = vi.spyOn(crypto, 'getRandomValues');
            const excludedIds: string[] = [];

            // Act
            const result = getSecureRandomQuestGameWithExclusion(
                "true-false",
                "short",
                excludedIds
            );

            // Assert
            expect(result).not.toBeNull();
            expect(result!.type).toBe("true-false");
            expect(result!.duration).toBe("short");
            expect(cryptoSpy).toHaveBeenCalled();
            cryptoSpy.mockRestore();
        });
    });
});
