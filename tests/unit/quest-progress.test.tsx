import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QuestProgress } from "@/components/game/quest-progress";
import { QuestType, QuestDuration } from "@/types/quest";

// Mock the store
const mockUseGameStore = vi.hoisted(() => vi.fn());

vi.mock('@/lib/store/game-store', () => ({
    useGameStore: mockUseGameStore,
}));

describe("QuestProgress", () => {
    beforeEach(() => {
      vi.clearAllMocks();
      // Default mock with required properties
      mockUseGameStore.mockReturnValue({
        getImpostorQuestData: () => ({
            quests: [],
            completed: 0,
            total: 0,
            percentage: 0,
        }),
        impostorQuestsInitialized: false,
      });
    });

    it("should render for Crewmate role", () => {
        render(<QuestProgress role="CREWMATE" completed={0} total={0} />);
        expect(screen.getByText("Progression des quêtes")).toBeTruthy();
    });

    it("should render loading state for Impostor role when not initialized", () => {
        mockUseGameStore.mockReturnValue({
            getImpostorQuestData: () => ({
                quests: [],
                completed: 0,
                total: 0,
                percentage: 0,
            }),
            impostorQuestsInitialized: false,
        } as const);

        render(<QuestProgress role="IMPOSTOR" completed={0} total={0} />);
        expect(screen.getByText("Progression des quêtes")).toBeTruthy();
        // Should show loading skeleton
        expect(screen.getByText("Progression des quêtes").closest('.p-4')?.querySelector('.animate-pulse')).toBeTruthy();
    });

    it("should render quest list for Impostor role when initialized", () => {
        mockUseGameStore.mockReturnValue({
            getImpostorQuestData: () => ({
                quests: [
                    { id: 'quest1', type: 'qcm' as QuestType, duration: 'short' as QuestDuration, location: 'Salle des machines', completed: false },
                    { id: 'quest2', type: 'true-false' as QuestType, duration: 'medium' as QuestDuration, location: 'Pont de commandement', completed: true },
                ],
                completed: 1,
                total: 2,
                percentage: 50,
            }),
            impostorQuestsInitialized: true,
        } as const);

        render(<QuestProgress role="IMPOSTOR" completed={0} total={0} />);
        expect(screen.getByText("Progression des quêtes")).toBeTruthy();
        expect(screen.getByText("1/2 quêtes accomplies")).toBeTruthy();
        expect(screen.getByText("Quête 1")).toBeTruthy();
        expect(screen.getByText("📍 Salle des machines")).toBeTruthy();
    });

    it("should show placeholder text when total is 0", () => {
        render(<QuestProgress role="CREWMATE" completed={0} total={0} />);
        expect(screen.getByText("En attente de missions...")).toBeTruthy();
    });

    it("should show quest count when total > 0", () => {
        render(<QuestProgress role="CREWMATE" completed={3} total={5} />);
        expect(screen.getByText("3/5 quêtes accomplies")).toBeTruthy();
    });

    it("should render progress bar with correct aria attributes", () => {
        render(<QuestProgress role="CREWMATE" completed={2} total={4} />);
        const progressBar = screen.getByRole("progressbar");
        expect(progressBar.getAttribute("aria-valuenow")).toBe("2");
        expect(progressBar.getAttribute("aria-valuemin")).toBe("0");
        expect(progressBar.getAttribute("aria-valuemax")).toBe("4");
    });

    it("should render progress bar at 0% width when no quests completed", () => {
        render(<QuestProgress role="CREWMATE" completed={0} total={5} />);
        const progressBar = screen.getByRole("progressbar");
        expect(progressBar.style.width).toBe("0%");
    });

    it("should render progress bar at 60% width for 3/5 quests", () => {
        render(<QuestProgress role="CREWMATE" completed={3} total={5} />);
        const progressBar = screen.getByRole("progressbar");
        expect(progressBar.style.width).toBe("60%");
    });

    it("should use Rajdhani font for labels", () => {
        render(<QuestProgress role="CREWMATE" completed={0} total={0} />);
        const label = screen.getByText("Progression des quêtes");
        expect(label.className).toContain("font-rajdhani");
    });
});
