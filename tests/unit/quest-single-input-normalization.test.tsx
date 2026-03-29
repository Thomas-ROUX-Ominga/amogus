import { beforeEach, describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QuestSingleInput } from "@/components/game/quest-single-input";
import { QuestGame } from "@/types/quest";

describe("QuestSingleInput Normalization", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        Object.defineProperty(navigator, "vibrate", {
            value: vi.fn(),
            writable: true,
            configurable: true,
        });
    });

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
        expect(onError).not.toHaveBeenCalled();
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
        expect(onSuccess).not.toHaveBeenCalled();
    });

    it("should show almost feedback for close typo and keep quest active", () => {
        const onSuccess = vi.fn();
        const onError = vi.fn();

        const quest: Extract<QuestGame, { type: "single-input" }> = {
            id: "q2",
            type: "single-input",
            duration: "short",
            title: "Test",
            instruction: "Type 'schumacher'",
            data: {
                answer: "schumacher",
                placeholder: "Type...",
                validation: { trim: true, case: "insensitive" }
            }
        };

        render(<QuestSingleInput quest={quest} onSuccess={onSuccess} onError={onError} />);

        const input = screen.getByLabelText("Réponse de la quête");
        fireEvent.change(input, { target: { value: "schumaher" } });
        fireEvent.submit(input.closest("form")!);

        expect(screen.getByText("Presque, essaye encore !")).toBeTruthy();
        expect(onSuccess).not.toHaveBeenCalled();
        expect(onError).not.toHaveBeenCalled();
    });

    it("should not crash when validation is missing and still accept normalized answer", () => {
        const onSuccess = vi.fn();
        const onError = vi.fn();

        const quest = {
            id: "q3",
            type: "single-input",
            duration: "short",
            title: "Test",
            instruction: "Type 'elephant'",
            data: {
                answer: "elephant",
                placeholder: "Type...",
            },
        } as unknown as Extract<QuestGame, { type: "single-input" }>;

        render(<QuestSingleInput quest={quest} onSuccess={onSuccess} onError={onError} />);

        const input = screen.getByLabelText("Réponse de la quête");
        fireEvent.change(input, { target: { value: "  Éléphant  " } });
        fireEvent.submit(input.closest("form")!);

        expect(onSuccess).toHaveBeenCalled();
        expect(onError).not.toHaveBeenCalled();
    });
});
