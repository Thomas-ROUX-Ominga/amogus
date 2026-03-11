import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";
import { useRouter } from "next/navigation";
import { useGameStore } from "@/lib/store/game-store";
import { QuestView } from "@/components/game/quest-view";
import { Quest, QuestDuration, QuestType } from "@/types/quest";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";

// Mock dependencies
vi.mock("next/navigation");
vi.mock("@/lib/store/game-store");

const mockPush = vi.fn();
const mockUseRouter = vi.mocked(useRouter);
const mockUseGameStore = vi.mocked(useGameStore);

const mockQuestId = "quest-123";
const mockGameId = "game-456";
const mockUserId = "user-impostor";

const mockQuest: Quest = {
    id: mockQuestId,
    type: "true-false" as QuestType,
    duration: "short" as QuestDuration,
    location: "Machine à café"
};

const mockImpostorGameState = {
    id: mockGameId,
    status: "IN_PROGRESS" as const,
    players: [
        {
            id: mockUserId,
            name: "Impostor Player",
            isAlive: true,
            role: "IMPOSTOR",
            completedQuests: []
        }
    ],
    createdAt: Date.now(),
    revision: 1,
    updatedAt: Date.now(),
    questsTotal: 10,
    questsPerPlayer: { short: 2, medium: 2, long: 2 }
};

describe("Integration: Impostor Scan Flow", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockUseRouter.mockReturnValue({
            push: mockPush,
            replace: vi.fn(),
            back: vi.fn(),
            forward: vi.fn(),
            refresh: vi.fn(),
            prefetch: vi.fn()
        } as AppRouterInstance);

        // Mock navigator.vibrate
        Object.defineProperty(navigator, 'vibrate', {
            writable: true,
            value: vi.fn()
        });

        // Mock timer for success overlay duration
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("should complete full impostor scan flow: immediate success -> auto redirect", async () => {
        // Arrange
        const mockCompleteQuestAction = vi.fn().mockResolvedValue(true);
        const mockClearQuest = vi.fn();

        mockUseGameStore.mockReturnValue({
            gameState: mockImpostorGameState,
            clearQuest: mockClearQuest,
            setQuestAnswered: vi.fn(),
            completeQuestAction: mockCompleteQuestAction,
            isCompletingQuest: false,
            completionError: null,
            completionErrorCode: null,
            questAnswered: false,
            currentQuestContent: null,
            recordFailedQuest: vi.fn()
        } as Partial<ReturnType<typeof useGameStore>>);

        // Act - Render quest view (simulates QR scan)
        render(
            <QuestView 
                quest={mockQuest} 
                gameId={mockGameId} 
                userId={mockUserId}
            />
        );

        // Advance timers to trigger the setTimeout in the impostor effect
        act(() => {
            vi.advanceTimersByTime(0);
        });

        // Assert - Success overlay appears
        const overlay = document.querySelector('h1.text-\\[\\#DA3633\\]');
        expect(overlay).toBeInTheDocument();

        // Assert - No quest content visible at any point
        expect(screen.queryByText("Machine à café")).not.toBeInTheDocument();
        expect(screen.queryByText("Chargement de la quête...")).not.toBeInTheDocument();

        // Assert - Quest completion is NOT called for impostors (immediate success without completion)
        expect(mockCompleteQuestAction).not.toHaveBeenCalled();

        // Act - Advance time for auto redirect trigger
        await act(async () => {
            vi.advanceTimersByTime(2000); // Ensure we pass the 1500ms threshold
        });

        // Assert - Auto redirect callback should be called
        expect(mockPush).toHaveBeenCalledWith(`/game/${mockGameId}`);
        expect(mockClearQuest).toHaveBeenCalledTimes(1);
    }, 10000);

    it("should maintain 2000ms success overlay timing matching crewmate experience", async () => {
        // Arrange
        mockUseGameStore.mockReturnValue({
            gameState: mockImpostorGameState,
            clearQuest: vi.fn(),
            setQuestAnswered: vi.fn(),
            completeQuestAction: vi.fn().mockResolvedValue(true),
            isCompletingQuest: false,
            completionError: null,
            completionErrorCode: null,
            questAnswered: false,
            currentQuestContent: null,
            recordFailedQuest: vi.fn()
        } as Partial<ReturnType<typeof useGameStore>>);

        // Act
        render(
            <QuestView 
                quest={mockQuest} 
                gameId={mockGameId} 
                userId={mockUserId} 
            />
        );

        // Advance timers to trigger the setTimeout in the impostor effect
        act(() => {
            vi.advanceTimersByTime(0);
        });

        // Assert - Success overlay appears
        const overlay = document.querySelector('h1.text-\\[\\#DA3633\\]');
        expect(overlay).toBeInTheDocument();

        // Assert - Success overlay persists for full 2000ms
        act(() => {
            vi.advanceTimersByTime(1999);
        });
        expect(document.querySelector('h1.text-\\[\\#DA3633\\]')).toBeInTheDocument();

        // Assert - Auto redirect callback is triggered after 2000ms
        act(() => {
            vi.advanceTimersByTime(2000); // Total 4000ms to trigger auto-exit
        });
        
        // The overlay should still be there (AnimatePresence handles the exit)
        // but the callback should have been called
        expect(mockPush).toHaveBeenCalledTimes(1);
    }, 10000);

    it("should prevent any quest content network calls for impostors", async () => {
        // Arrange - Spy on network calls through store actions
        const mockLoadDynamicQuestContent = vi.fn();
        const mockStore = {
            gameState: mockImpostorGameState,
            clearQuest: vi.fn(),
            setQuestAnswered: vi.fn(),
            completeQuestAction: vi.fn().mockResolvedValue(true),
            isCompletingQuest: false,
            completionError: null,
            completionErrorCode: null,
            questAnswered: false,
            currentQuestContent: null,
            recordFailedQuest: vi.fn(),
            loadDynamicQuestContent: mockLoadDynamicQuestContent
        };

        mockUseGameStore.mockReturnValue(mockStore as Partial<ReturnType<typeof useGameStore>>);

        // Act
        render(
            <QuestView 
                quest={mockQuest} 
                gameId={mockGameId} 
                userId={mockUserId} 
            />
        );

        // Advance timers to trigger the setTimeout in the impostor effect
        act(() => {
            vi.advanceTimersByTime(0);
        });

        // Assert - Success overlay appears
        expect(screen.getByText((content, element) => {
            return content.includes('MISSION') && content.includes('ACCOMPLIE');
        })).toBeInTheDocument();

        // Assert - No content loading attempts made
        expect(mockLoadDynamicQuestContent).not.toHaveBeenCalled();
    });

    it("should handle completion errors gracefully for impostors", async () => {
        // Arrange
        const mockCompleteQuestAction = vi.fn().mockResolvedValue(false);

        mockUseGameStore.mockReturnValue({
            gameState: mockImpostorGameState,
            clearQuest: vi.fn(),
            setQuestAnswered: vi.fn(),
            completeQuestAction: mockCompleteQuestAction,
            isCompletingQuest: false,
            completionError: null,
            completionErrorCode: null,
            questAnswered: false,
            currentQuestContent: null,
            recordFailedQuest: vi.fn()
        } as Partial<ReturnType<typeof useGameStore>>);

        // Act
        render(
            <QuestView 
                quest={mockQuest} 
                gameId={mockGameId} 
                userId={mockUserId} 
            />
        );

        // Advance timers to trigger the setTimeout in the impostor effect
        act(() => {
            vi.advanceTimersByTime(0);
        });

        // Assert - Success overlay appears immediately for impostors regardless of completion function
        expect(screen.getByText((content, element) => {
            return content.includes('MISSION') && content.includes('ACCOMPLIE');
        })).toBeInTheDocument();

        // Assert - completeQuestAction is NOT called for impostors (they get immediate success)
        expect(mockCompleteQuestAction).not.toHaveBeenCalled();
    });

    it("should work with different quest durations for impostors", async () => {
        // Arrange - Test with medium duration quest
        const mediumQuest: Quest = {
            ...mockQuest,
            duration: "medium" as QuestDuration
        };

        mockUseGameStore.mockReturnValue({
            gameState: mockImpostorGameState,
            clearQuest: vi.fn(),
            setQuestAnswered: vi.fn(),
            completeQuestAction: vi.fn().mockResolvedValue(true),
            isCompletingQuest: false,
            completionError: null,
            completionErrorCode: null,
            questAnswered: false,
            currentQuestContent: null,
            recordFailedQuest: vi.fn()
        } as Partial<ReturnType<typeof useGameStore>>);

        // Act
        render(
            <QuestView 
                quest={mediumQuest} 
                gameId={mockGameId} 
                userId={mockUserId}
            />
        );

        // Advance timers to trigger the setTimeout in the impostor effect
        act(() => {
            vi.advanceTimersByTime(0);
        });

        // Assert - Success overlay appears (check for the red background)
        expect(screen.getByText((content, element) => {
            return content.includes('MISSION') && content.includes('ACCOMPLIE');
        })).toBeInTheDocument();

        // Assert - No duration badge shown for impostors
        expect(screen.queryByText("MOYEN")).not.toBeInTheDocument();
    });
});
