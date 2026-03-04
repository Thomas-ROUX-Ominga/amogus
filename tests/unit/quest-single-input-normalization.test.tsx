import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QuestSingleInput } from "@/components/game/quest-single-input";
import { QuestGame } from "@/types/quest";

vi.mock("@/lib/store/game-store", () => ({
    useGameStore: () => ({}),
}));

vi.mock("@/hooks/use-quest-answer", () => ({
    useQuestAnswer: vi.fn((quest, validateAnswer, onSuccess, onError) => ({
        isCorrect: null,
        answered: false,
        failed: false,
        handleAnswer: (val: string) => {
            const correct = validateAnswer(val);
            if (correct) onSuccess();
            else onError();
        },
        handleRetry: vi.fn(),
    })),
}));

describe("QuestSingleInput Normalization", () => {
    it("should accept answers with different accents when case insensitive", () => {
        const onSuccess = vi.fn();
        const onError = vi.fn();
        
        const quest: Extract<QuestGame, { type: "single-input" }> = {
            id: "q1",
            type: "single-input",
            duration: "short",
            title: "Test",
            instruction: "Type 'elephant'",
            data: {
                answer: "elephant",
                placeholder: "Type...",
                validation: { trim: true, case: "insensitive" }
            }
        };

        render(<QuestSingleInput quest={quest} onSuccess={onSuccess} onError={onError} />);
        
        const input = screen.getByLabelText("Réponse de la quête");
        fireEvent.change(input, { target: { value: "Éléphant" } });
        fireEvent.submit(input.closest("form")!);
        
        expect(onSuccess).toHaveBeenCalled();
    });

    it("should reject wrong answers", () => {
        const onSuccess = vi.fn();
        const onError = vi.fn();
        
        const quest: Extract<QuestGame, { type: "single-input" }> = {
            id: "q1",
            type: "single-input",
            duration: "short",
            title: "Test",
            instruction: "Type 'elephant'",
            data: {
                answer: "elephant",
                placeholder: "Type...",
                validation: { trim: true, case: "insensitive" }
            }
        };

        render(<QuestSingleInput quest={quest} onSuccess={onSuccess} onError={onError} />);
        
        const input = screen.getByLabelText("Réponse de la quête");
        fireEvent.change(input, { target: { value: "giraffe" } });
        fireEvent.submit(input.closest("form")!);
        
        expect(onError).toHaveBeenCalled();
    });
});
