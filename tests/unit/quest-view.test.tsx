import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { QuestView } from "@/components/game/quest-view";
import { Quest } from "@/types/quest";
import { GameState } from "@/types/game";

const mockPush = vi.fn();
const mockClearQuest = vi.fn();
const mockSetQuestAnswered = vi.fn();
const mockCompleteQuestAction = vi.fn();
vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: mockPush }),
}));

let mockStoreState = {
    clearQuest: mockClearQuest,
    setQuestAnswered: mockSetQuestAnswered,
    completeQuestAction: mockCompleteQuestAction,
    isCompletingQuest: false,
    completionError: null as string | null,
    questAnswered: false,
    gameState: {
        players: [{ id: "user-1", role: "CREWMATE" }]
    } as unknown as GameState,
};

vi.mock("@/lib/store/game-store", () => ({
    useGameStore: () => mockStoreState,
}));

const mockQuest: Quest = {
    id: "s1",
    type: "true-false",
    duration: "short",
    title: "Vérification de Protocole",
    instruction: "Le vaisseau spatial possède exactement 12 modules de survie. Vrai ou Faux ?",
    options: [
        { label: "VRAI", value: "true" },
        { label: "FAUX", value: "false" },
    ],
    answer: "true",
};

describe("QuestView", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockCompleteQuestAction.mockResolvedValue(true);
        mockStoreState = {
            clearQuest: mockClearQuest,
            setQuestAnswered: mockSetQuestAnswered,
            completeQuestAction: mockCompleteQuestAction,
            isCompletingQuest: false,
            completionError: null,
            questAnswered: false,
            gameState: {
                players: [{ id: "user-1", role: "CREWMATE" }]
            } as unknown as GameState,
        };
        Object.defineProperty(navigator, "vibrate", {
            value: vi.fn(),
            writable: true,
            configurable: true,
        });
    });

    it("should render quest title", () => {
        render(<QuestView quest={mockQuest} gameId="game-123" />);
        expect(screen.getByText("Vérification de Protocole")).toBeTruthy();
    });

    it("should render quest instruction", () => {
        render(<QuestView quest={mockQuest} gameId="game-123" />);
        expect(screen.getByText(/Le vaisseau spatial/)).toBeTruthy();
    });

    it("should render duration badge with correct label", () => {
        render(<QuestView quest={mockQuest} gameId="game-123" />);
        expect(screen.getByText("COURT")).toBeTruthy();
    });

    it("should render medium duration badge", () => {
        const mediumQuest: Quest = { ...mockQuest, duration: "medium" };
        render(<QuestView quest={mediumQuest} gameId="game-123" />);
        expect(screen.getByText("MOYEN")).toBeTruthy();
    });

    it("should render long duration badge", () => {
        const longQuest: Quest = { ...mockQuest, duration: "long" };
        render(<QuestView quest={longQuest} gameId="game-123" />);
        expect(screen.getByText("LONG")).toBeTruthy();
    });

    it("should render 'Quest Active' header", () => {
        render(<QuestView quest={mockQuest} gameId="game-123" />);
        expect(screen.getByText("Quest Active")).toBeTruthy();
    });

    it("should render flee button with 'Abandonner' text", () => {
        render(<QuestView quest={mockQuest} gameId="game-123" />);
        expect(screen.getByText("Abandonner")).toBeTruthy();
    });

    it("should clear quest and navigate to game home when flee button is clicked", () => {
        render(<QuestView quest={mockQuest} gameId="game-123" />);
        const fleeButton = screen.getByText("Abandonner").closest("button")!;
        fireEvent.click(fleeButton);
        expect(mockClearQuest).toHaveBeenCalled();
        expect(mockPush).toHaveBeenCalledWith("/game/game-123");
    });

    it("should have flee button with correct aria-label", () => {
        render(<QuestView quest={mockQuest} gameId="game-123" />);
        const fleeButton = screen.getByLabelText("Abandonner la quête et retourner au Game Home");
        expect(fleeButton).toBeTruthy();
    });

    it("should have minimum touch target size on flee button", () => {
        render(<QuestView quest={mockQuest} gameId="game-123" />);
        const fleeButton = screen.getByText("Abandonner").closest("button")!;
        expect(fleeButton.className).toContain("min-h-[56px]");
    });

    it("should render quest ID in footer", () => {
        render(<QuestView quest={mockQuest} gameId="game-123" />);
        expect(screen.getByText("Quest: s1")).toBeTruthy();
    });

    it("should render quest type in footer", () => {
        render(<QuestView quest={mockQuest} gameId="game-123" />);
        expect(screen.getByText("Type: true-false")).toBeTruthy();
    });

    it("should trigger haptic feedback on flee", () => {
        const vibrateMock = vi.fn();
        Object.defineProperty(navigator, "vibrate", {
            value: vibrateMock,
            writable: true,
            configurable: true,
        });

        render(<QuestView quest={mockQuest} gameId="game-123" />);
        const fleeButton = screen.getByText("Abandonner").closest("button")!;
        fireEvent.click(fleeButton);
        expect(vibrateMock).toHaveBeenCalledWith([50]);
    });

    it("should render QuestRenderer with answer buttons instead of placeholder", () => {
        render(<QuestView quest={mockQuest} gameId="game-123" />);
        // QuestRenderer dispatches to QuestTrueFalse which renders VRAI/FAUX buttons
        expect(screen.getByLabelText("Répondre VRAI")).toBeTruthy();
        expect(screen.getByLabelText("Répondre FAUX")).toBeTruthy();
    });

    it("should not render the old placeholder text", () => {
        render(<QuestView quest={mockQuest} gameId="game-123" />);
        expect(screen.queryByText(/Zone d'interaction/)).toBeNull();
    });

    it("should show completion confirmation when quest is answered and completion succeeds", () => {
        mockStoreState.questAnswered = true;
        mockStoreState.isCompletingQuest = false;
        mockStoreState.completionError = null;
        render(<QuestView quest={mockQuest} gameId="game-123" userId="user-1" />);
        expect(screen.getByText("MISSION ENREGISTRÉE")).toBeTruthy();
    });

    it("should show completion error with retry button on failure", () => {
        mockStoreState.questAnswered = true;
        mockStoreState.completionError = "Failed to record quest completion.";
        render(<QuestView quest={mockQuest} gameId="game-123" userId="user-1" />);
        expect(screen.getByText("ERREUR DE SAUVEGARDE")).toBeTruthy();
        expect(screen.getByText("RÉESSAYER")).toBeTruthy();
    });

    it("should call completeQuestAction when retry button is clicked", () => {
        mockStoreState.questAnswered = true;
        mockStoreState.completionError = "Failed";
        mockCompleteQuestAction.mockResolvedValue(true);
        render(<QuestView quest={mockQuest} gameId="game-123" userId="user-1" />);
        const retryButton = screen.getByText("RÉESSAYER").closest("button")!;
        fireEvent.click(retryButton);
        expect(mockCompleteQuestAction).toHaveBeenCalledWith("game-123", "user-1", "s1");
    });

    it("should show loading state during completion", () => {
        mockStoreState.questAnswered = true;
        mockStoreState.isCompletingQuest = true;
        render(<QuestView quest={mockQuest} gameId="game-123" userId="user-1" />);
        expect(screen.getByText("Enregistrement...")).toBeTruthy();
    });

    it("should show SuccessOverlay when completion succeeds", async () => {
        mockStoreState.questAnswered = true;
        mockStoreState.isCompletingQuest = false;
        mockStoreState.completionError = null;
        mockCompleteQuestAction.mockResolvedValue(true);
        
        render(<QuestView quest={mockQuest} gameId="game-123" userId="user-1" />);
        
        // Wait for effect to run and state to update
        await screen.findByText((content, element) => {
            return element?.tagName.toLowerCase() === 'h1' && 
                   content.includes('MISSION') && 
                   content.includes('ACCOMPLIE');
        });
    });

    it("should auto-redirect after delay when completion succeeds", async () => {
        vi.useFakeTimers();
        mockStoreState.questAnswered = true;
        mockStoreState.isCompletingQuest = false;
        mockStoreState.completionError = null;
        mockCompleteQuestAction.mockResolvedValue(true);
        
        render(<QuestView quest={mockQuest} gameId="game-123" userId="user-1" />);
        
        // Allow the useEffect to run and the promise to resolve
        await act(async () => {
            await Promise.resolve();
            await Promise.resolve();
        });

        // The overlay should be present now
        expect(screen.getByText((content, element) => {
            return element?.tagName.toLowerCase() === 'h1' && 
                   content.includes('MISSION') && 
                   content.includes('ACCOMPLIE');
        })).toBeTruthy();
        
        // Fast-forward time for the redirect timer
        await act(async () => {
            vi.advanceTimersByTime(3000);
        });
        
        expect(mockPush).toHaveBeenCalledWith("/game/game-123");
        expect(mockClearQuest).toHaveBeenCalled();
        
        vi.useRealTimers();
    });

    it("should show SuccessOverlay and redirect when retry succeeds after failure", async () => {
        vi.useFakeTimers();
        
        // Start with not answered
        mockStoreState.questAnswered = false;
        mockStoreState.completionError = null;
        
        const { rerender } = render(<QuestView quest={mockQuest} gameId="game-123" userId="user-1" />);

        // User answers correctly
        mockStoreState.questAnswered = true;
        
        // First attempt fails
        mockCompleteQuestAction.mockResolvedValueOnce(false);
        
        // Trigger re-render to fire useEffect
        rerender(<QuestView quest={mockQuest} gameId="game-123" userId="user-1" />);
        
        // Wait for first attempt
        await act(async () => {
            await Promise.resolve();
        });

        // Simulate store update with error
        mockStoreState.completionError = "Failed";
        rerender(<QuestView quest={mockQuest} gameId="game-123" userId="user-1" />);

        // Verify error state
        expect(screen.getByText("ERREUR DE SAUVEGARDE")).toBeTruthy();

        // Setup retry to succeed
        mockCompleteQuestAction.mockResolvedValue(true);

        // Click Retry
        const retryButton = screen.getByText("RÉESSAYER").closest("button")!;
        fireEvent.click(retryButton);

        // Wait for retry promise to resolve
        await act(async () => {
            await Promise.resolve();
            await Promise.resolve();
        });

        // Expect SuccessOverlay to appear
        expect(screen.getByText((content, element) => {
            return element?.tagName.toLowerCase() === 'h1' && 
                   content.includes('MISSION') && 
                   content.includes('ACCOMPLIE');
        })).toBeTruthy();

        // Fast-forward for redirect
        await act(async () => {
            vi.advanceTimersByTime(3000);
        });

        expect(mockPush).toHaveBeenCalledWith("/game/game-123");
        expect(mockClearQuest).toHaveBeenCalled();

        vi.useRealTimers();
    });

    it("should hide quest title and duration badge if player is an IMPOSTOR", () => {
        mockStoreState.gameState = {
            players: [{ id: "user-1", role: "IMPOSTOR" }]
        } as unknown as GameState;
        
        render(<QuestView quest={mockQuest} gameId="game-123" userId="user-1" />);
        
        // Title should be hidden or replaced with generic text
        expect(screen.queryByText(mockQuest.title)).toBeNull();
        
        // Duration badge should be hidden
        expect(screen.queryByText("COURT")).toBeNull();
        expect(screen.queryByText("MOYEN")).toBeNull();
        expect(screen.queryByText("LONG")).toBeNull();
    });
});
