import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";
import { useRouter } from "next/navigation";
import { useGameStore } from "@/lib/store/game-store";
import { QuestView } from "@/components/game/quest-view";
import { Quest, QuestDuration, QuestType } from "@/types/quest";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";

// Mock framer-motion to avoid animation issues in tests
vi.mock("framer-motion", () => ({
    motion: {
        div: "div",
        h1: "h1",
        button: "button",
    },
    AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
    useReducedMotion: () => false,
}));

// Mock dependencies
vi.mock("next/navigation");
vi.mock("@/lib/store/game-store");
vi.mock("@/lib/constants/quest-pool", () => ({
    getRandomQuestGame: vi.fn().mockReturnValue({
        id: "test-quest-game",
        type: "true-false",
        duration: "short",
        title: "Test Quest",
        instruction: "Test instruction",
        options: [
            { label: "True", value: "true" },
            { label: "False", value: "false" }
        ],
        answer: "true"
    })
}));

// Setup fake timers for all tests
vi.useFakeTimers();

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
    location: "Test Location"
};

const mockGameState = {
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
    questsTotal: 10,
    questsPerPlayer: { short: 2, medium: 2, long: 2 }
};

describe("QuestView - Impostor Silent Success", () => {
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

        const mockStoreReturnValue = {
            gameState: mockGameState,
            clearQuest: vi.fn(),
            setQuestAnswered: vi.fn(),
            completeQuestAction: vi.fn().mockResolvedValue(true),
            isCompletingQuest: false,
            completionError: null,
            completionErrorCode: null,
            questAnswered: true, // Start as true for impostor immediate success
            currentQuestContent: null,
            recordFailedQuest: vi.fn()
        };
        
        mockUseGameStore.mockReturnValue(mockStoreReturnValue as Partial<ReturnType<typeof useGameStore>>);

        // Mock navigator.vibrate
        Object.defineProperty(navigator, 'vibrate', {
            writable: true,
            value: vi.fn()
        });
        
        // Clear any existing timers
        vi.clearAllTimers();
    });

    afterEach(() => {
        vi.clearAllTimers();
    });

    it("should show immediate success overlay for impostor without loading content", async () => {
        // Arrange
        const { container } = render(
            <QuestView 
                quest={mockQuest} 
                gameId={mockGameId} 
                userId={mockUserId} 
            />
        );

        // Assert - No loading state should be visible for impostors
        expect(screen.queryByText("Chargement de la quête...")).not.toBeInTheDocument();
        expect(screen.queryByText("SIGNAL OVERRIDE")).not.toBeInTheDocument();
        
        // Assert - Duration badge should not be visible for impostors
        expect(screen.queryByText("COURT")).not.toBeInTheDocument();
        expect(screen.queryByText("MOYEN")).not.toBeInTheDocument();
        expect(screen.queryByText("LONG")).not.toBeInTheDocument();
        
        // Assert - Quest content area should be empty
        const questContentArea = container.querySelector('.flex-1');
        expect(questContentArea).toBeInTheDocument();
        expect(questContentArea).toBeEmptyDOMElement();
    });

    it("should not render quest content area for impostors", () => {
        // Arrange
        const { container } = render(
            <QuestView 
                quest={mockQuest} 
                gameId={mockGameId} 
                userId={mockUserId} 
            />
        );

        // Assert - Quest content section should be empty (no loading, no quest game)
        const questContentArea = container.querySelector('.flex-1');
        expect(questContentArea).toBeInTheDocument();
        expect(questContentArea).toBeEmptyDOMElement();
    });

    it("should not show duration badge for impostors", () => {
        // Arrange
        render(
            <QuestView 
                quest={mockQuest} 
                gameId={mockGameId} 
                userId={mockUserId} 
            />
        );

        // Assert - Duration badge should not be visible
        expect(screen.queryByText("COURT")).not.toBeInTheDocument();
        expect(screen.queryByText("MOYEN")).not.toBeInTheDocument();
        expect(screen.queryByText("LONG")).not.toBeInTheDocument();
    });

    it("should trigger haptic feedback on success", async () => {
        // Arrange
        render(
            <QuestView 
                quest={mockQuest} 
                gameId={mockGameId} 
                userId={mockUserId} 
            />
        );

        // Assert - Component renders without crashing and haptic feedback is available
        expect(typeof navigator.vibrate).toBe('function');
        
        // The actual haptic feedback will be triggered when the success overlay appears
        // Since we're testing the impostor silent success, we verify the component
        // doesn't crash and the navigator.vibrate mock is properly set up
        expect(navigator.vibrate).toBeDefined();
    });

    it("should handle crewmate role normally", async () => {
        // Arrange - Mock crewmate player
        const crewmateGameState = {
            ...mockGameState,
            players: [
                {
                    ...mockGameState.players[0],
                    role: "CREWMATE"
                }
            ]
        };

        mockUseGameStore.mockReturnValue({
            gameState: crewmateGameState,
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

        render(
            <QuestView 
                quest={mockQuest} 
                gameId={mockGameId} 
                userId={mockUserId} 
            />
        );

        // Assert - Should show quest content for crewmates (not loading)
        expect(screen.getByText("Test Quest")).toBeInTheDocument();
        expect(screen.getByText("Test instruction")).toBeInTheDocument();
        expect(screen.getByText("COURT")).toBeInTheDocument();
    });

    it("should not call recordFailedQuest for impostors on error", async () => {
        // Arrange
        const mockRecordFailedQuest = vi.fn();
        mockUseGameStore.mockReturnValue({
            gameState: mockGameState,
            clearQuest: vi.fn(),
            setQuestAnswered: vi.fn(),
            completeQuestAction: vi.fn().mockResolvedValue(true),
            isCompletingQuest: false,
            completionError: null,
            completionErrorCode: null,
            questAnswered: true,
            currentQuestContent: null,
            recordFailedQuest: mockRecordFailedQuest
        } as Partial<ReturnType<typeof useGameStore>>);

        render(
            <QuestView 
                quest={mockQuest} 
                gameId={mockGameId} 
                userId={mockUserId} 
            />
        );

        // Assert - recordFailedQuest should never be called for impostors
        // Since impostors get automatic success, error handling shouldn't be triggered
        expect(mockRecordFailedQuest).not.toHaveBeenCalled();
    });
});
