import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QuestQCM } from "@/components/game/quest-qcm";
import { QuestGame } from "@/types/quest";

const mockQuest: Extract<QuestGame, { type: "qcm" }> = {
    id: "s2",
    type: "qcm",
    duration: "short",
    title: "Test QCM",
    instruction: "Pick one",
    data: {
        mode: "single",
        choices: [
            { id: "a", label: "Option A" },
            { id: "b", label: "Option B" },
            { id: "c", label: "Option C" },
            { id: "d", label: "Option D" },
        ],
        answerIds: ["c"],
    }
};

describe("QuestQCM", () => {
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

    it("should render all options", () => {
        render(<QuestQCM quest={mockQuest} onSuccess={onSuccess} onError={onError} />);
        expect(screen.getByText("Option A")).toBeTruthy();
        expect(screen.getByText("Option B")).toBeTruthy();
        expect(screen.getByText("Option C")).toBeTruthy();
        expect(screen.getByText("Option D")).toBeTruthy();
    });

    it("should call onSuccess when correct answer is selected", () => {
        render(<QuestQCM quest={mockQuest} onSuccess={onSuccess} onError={onError} />);
        fireEvent.click(screen.getByLabelText("Option C: Option C"));
        expect(onSuccess).toHaveBeenCalledTimes(1);
        expect(onError).not.toHaveBeenCalled();
    });

    it("should call onError when wrong answer is selected", () => {
        render(<QuestQCM quest={mockQuest} onSuccess={onSuccess} onError={onError} />);
        fireEvent.click(screen.getByLabelText("Option A: Option A"));
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
        render(<QuestQCM quest={mockQuest} onSuccess={onSuccess} onError={onError} />);
        fireEvent.click(screen.getByLabelText("Option C: Option C"));
        expect(vibrateMock).toHaveBeenCalledWith([50, 50, 50]);
    });

    it("should trigger error haptic [200] on wrong answer", () => {
        const vibrateMock = vi.fn();
        Object.defineProperty(navigator, "vibrate", {
            value: vibrateMock,
            writable: true,
            configurable: true,
        });
        render(<QuestQCM quest={mockQuest} onSuccess={onSuccess} onError={onError} />);
        fireEvent.click(screen.getByLabelText("Option A: Option A"));
        expect(vibrateMock).toHaveBeenCalledWith([200]);
    });

    it("should disable buttons after correct answer", () => {
        render(<QuestQCM quest={mockQuest} onSuccess={onSuccess} onError={onError} />);
        fireEvent.click(screen.getByLabelText("Option C: Option C"));
        expect(screen.getByLabelText("Option A: Option A").hasAttribute("disabled")).toBe(true);
        expect(screen.getByLabelText("Option C: Option C").hasAttribute("disabled")).toBe(true);
    });

    it("should disable buttons after wrong answer (must retry first)", () => {
        render(<QuestQCM quest={mockQuest} onSuccess={onSuccess} onError={onError} />);
        fireEvent.click(screen.getByLabelText("Option A: Option A"));
        expect(screen.getByLabelText("Option A: Option A").hasAttribute("disabled")).toBe(true);
        expect(screen.getByLabelText("Option C: Option C").hasAttribute("disabled")).toBe(true);
    });

    it("should show retry button after wrong answer", () => {
        render(<QuestQCM quest={mockQuest} onSuccess={onSuccess} onError={onError} />);
        fireEvent.click(screen.getByLabelText("Option A: Option A"));
        expect(screen.getByLabelText("Réessayer la question")).toBeTruthy();
    });

    it("should reset state when retry is clicked", () => {
        render(<QuestQCM quest={mockQuest} onSuccess={onSuccess} onError={onError} />);
        fireEvent.click(screen.getByLabelText("Option A: Option A"));
        fireEvent.click(screen.getByLabelText("Réessayer la question"));
        expect(screen.getByLabelText("Option A: Option A").hasAttribute("disabled")).toBe(false);
    });

    it("should not call onSuccess twice on rapid double-click after correct answer", () => {
        render(<QuestQCM quest={mockQuest} onSuccess={onSuccess} onError={onError} />);
        fireEvent.click(screen.getByLabelText("Option C: Option C"));
        fireEvent.click(screen.getByLabelText("Option C: Option C"));
        expect(onSuccess).toHaveBeenCalledTimes(1);
    });

    it("should not allow switching answer after wrong without retry", () => {
        render(<QuestQCM quest={mockQuest} onSuccess={onSuccess} onError={onError} />);
        fireEvent.click(screen.getByLabelText("Option A: Option A"));
        fireEvent.click(screen.getByLabelText("Option C: Option C"));
        expect(onError).toHaveBeenCalledTimes(1);
        expect(onSuccess).not.toHaveBeenCalled();
    });

    it("should have role='radiogroup' container", () => {
        render(<QuestQCM quest={mockQuest} onSuccess={onSuccess} onError={onError} />);
        expect(screen.getByRole("radiogroup")).toBeTruthy();
    });

    it("should have ARIA labels with option letter prefix", () => {
        render(<QuestQCM quest={mockQuest} onSuccess={onSuccess} onError={onError} />);
        expect(screen.getByLabelText("Option A: Option A")).toBeTruthy();
        expect(screen.getByLabelText("Option B: Option B")).toBeTruthy();
        expect(screen.getByLabelText("Option C: Option C")).toBeTruthy();
        expect(screen.getByLabelText("Option D: Option D")).toBeTruthy();
    });

    it("should have touch-manipulation class on option cards", () => {
        render(<QuestQCM quest={mockQuest} onSuccess={onSuccess} onError={onError} />);
        const optionA = screen.getByLabelText("Option A: Option A");
        expect(optionA.className).toContain("touch-manipulation");
    });

    it("should have min-h-[48px] on option cards", () => {
        render(<QuestQCM quest={mockQuest} onSuccess={onSuccess} onError={onError} />);
        const optionA = screen.getByLabelText("Option A: Option A");
        expect(optionA.className).toContain("min-h-[48px]");
    });

    it("should have role='radio' on each option", () => {
        render(<QuestQCM quest={mockQuest} onSuccess={onSuccess} onError={onError} />);
        const radios = screen.getAllByRole("radio");
        expect(radios.length).toBe(4);
    });
});
