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
                "form",
                "short",
                excludedIds
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
                "form",
                "short",
                excludedIds
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
