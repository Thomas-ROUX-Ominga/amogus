import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QuestTrueFalse } from "@/components/game/quest-true-false";
import { QuestGame } from "@/types/quest";

const mockQuest: Extract<QuestGame, { type: "true-false" }> = {
    id: "s1",
    type: "true-false",
    duration: "short",
    title: "Test Question",
    instruction: "Is this true?",
    data: {
        choices: [
            { id: "true", label: "VRAI" },
            { id: "false", label: "FAUX" },
        ],
        answerIds: ["true"],
    }
};

describe("QuestTrueFalse", () => {
    const onSuccess = vi.fn();
    const onError = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        Object.defineProperty(navigator, "vibrate", {
            value: vi.fn(),
            writable: true,
            configurable: true,
        });
    });

    it("should render VRAI and FAUX buttons", () => {
        render(<QuestTrueFalse quest={mockQuest} onSuccess={onSuccess} onError={onError} />);
        expect(screen.getByLabelText("Répondre VRAI")).toBeTruthy();
        expect(screen.getByLabelText("Répondre FAUX")).toBeTruthy();
    });

    it("should call onSuccess when correct answer is selected", () => {
        render(<QuestTrueFalse quest={mockQuest} onSuccess={onSuccess} onError={onError} />);
        fireEvent.click(screen.getByLabelText("Répondre VRAI"));
        expect(onSuccess).toHaveBeenCalledTimes(1);
        expect(onError).not.toHaveBeenCalled();
    });

    it("should call onError when wrong answer is selected", () => {
        render(<QuestTrueFalse quest={mockQuest} onSuccess={onSuccess} onError={onError} />);
        fireEvent.click(screen.getByLabelText("Répondre FAUX"));
        expect(onError).toHaveBeenCalledTimes(1);
        expect(onSuccess).not.toHaveBeenCalled();
    });

    it("should trigger success haptic [50, 50, 50] on correct answer", () => {
        const vibrateMock = vi.fn();
        Object.defineProperty(navigator, "vibrate", {
            value: vibrateMock,
            writable: true,
            configurable: true,
        });
        render(<QuestTrueFalse quest={mockQuest} onSuccess={onSuccess} onError={onError} />);
        fireEvent.click(screen.getByLabelText("Répondre VRAI"));
        expect(vibrateMock).toHaveBeenCalledWith([50, 50, 50]);
    });

    it("should trigger error haptic [200] on wrong answer", () => {
        const vibrateMock = vi.fn();
        Object.defineProperty(navigator, "vibrate", {
            value: vibrateMock,
            writable: true,
            configurable: true,
        });
        render(<QuestTrueFalse quest={mockQuest} onSuccess={onSuccess} onError={onError} />);
        fireEvent.click(screen.getByLabelText("Répondre FAUX"));
        expect(vibrateMock).toHaveBeenCalledWith([200]);
    });

    it("should disable buttons after correct answer", () => {
        render(<QuestTrueFalse quest={mockQuest} onSuccess={onSuccess} onError={onError} />);
        fireEvent.click(screen.getByLabelText("Répondre VRAI"));
        expect(screen.getByLabelText("Répondre VRAI").hasAttribute("disabled")).toBe(true);
        expect(screen.getByLabelText("Répondre FAUX").hasAttribute("disabled")).toBe(true);
    });

    it("should disable buttons after wrong answer (must retry first)", () => {
        render(<QuestTrueFalse quest={mockQuest} onSuccess={onSuccess} onError={onError} />);
        fireEvent.click(screen.getByLabelText("Répondre FAUX"));
        expect(screen.getByLabelText("Répondre VRAI").hasAttribute("disabled")).toBe(true);
        expect(screen.getByLabelText("Répondre FAUX").hasAttribute("disabled")).toBe(true);
    });

    it("should show retry button after wrong answer", () => {
        render(<QuestTrueFalse quest={mockQuest} onSuccess={onSuccess} onError={onError} />);
        fireEvent.click(screen.getByLabelText("Répondre FAUX"));
        expect(screen.getByLabelText("Réessayer la question")).toBeTruthy();
    });

    it("should reset state when retry is clicked", () => {
        render(<QuestTrueFalse quest={mockQuest} onSuccess={onSuccess} onError={onError} />);
        fireEvent.click(screen.getByLabelText("Répondre FAUX"));
        fireEvent.click(screen.getByLabelText("Réessayer la question"));
        // Buttons should be enabled again
        expect(screen.getByLabelText("Répondre VRAI").hasAttribute("disabled")).toBe(false);
        expect(screen.getByLabelText("Répondre FAUX").hasAttribute("disabled")).toBe(false);
    });

    it("should not call onSuccess twice on rapid double-click after correct answer", () => {
        render(<QuestTrueFalse quest={mockQuest} onSuccess={onSuccess} onError={onError} />);
        fireEvent.click(screen.getByLabelText("Répondre VRAI"));
        fireEvent.click(screen.getByLabelText("Répondre VRAI"));
        expect(onSuccess).toHaveBeenCalledTimes(1);
    });

    it("should not call onError twice without retry in between", () => {
        render(<QuestTrueFalse quest={mockQuest} onSuccess={onSuccess} onError={onError} />);
        fireEvent.click(screen.getByLabelText("Répondre FAUX"));
        // Second click should be ignored (buttons disabled, guard in hook)
        fireEvent.click(screen.getByLabelText("Répondre VRAI"));
        expect(onError).toHaveBeenCalledTimes(1);
        expect(onSuccess).not.toHaveBeenCalled();
    });

    it("should have role='group' container", () => {
        render(<QuestTrueFalse quest={mockQuest} onSuccess={onSuccess} onError={onError} />);
        expect(screen.getByRole("group")).toBeTruthy();
    });

    it("should have ARIA labels on buttons", () => {
        render(<QuestTrueFalse quest={mockQuest} onSuccess={onSuccess} onError={onError} />);
        expect(screen.getByLabelText("Répondre VRAI")).toBeTruthy();
        expect(screen.getByLabelText("Répondre FAUX")).toBeTruthy();
    });

    it("should have touch-manipulation class on buttons", () => {
        render(<QuestTrueFalse quest={mockQuest} onSuccess={onSuccess} onError={onError} />);
        const vraiBtn = screen.getByLabelText("Répondre VRAI");
        const fauxBtn = screen.getByLabelText("Répondre FAUX");
        expect(vraiBtn.className).toContain("touch-manipulation");
        expect(fauxBtn.className).toContain("touch-manipulation");
    });

    it("should have min-h-[56px] on answer buttons", () => {
        render(<QuestTrueFalse quest={mockQuest} onSuccess={onSuccess} onError={onError} />);
        const vraiBtn = screen.getByLabelText("Répondre VRAI");
        expect(vraiBtn.className).toContain("min-h-[56px]");
    });
});
