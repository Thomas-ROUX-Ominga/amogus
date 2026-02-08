import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QuestView } from "@/components/game/quest-view";
import { Quest } from "@/types/quest";

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
});
