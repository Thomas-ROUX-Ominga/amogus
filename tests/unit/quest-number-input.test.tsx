import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { QuestNumberInput } from "@/components/game/quest-number-input";
import { QuestGame } from "@/types/quest";

function buildQuest(answer: number): Extract<QuestGame, { type: "number-input" }> {
    return {
        id: `num-${answer}`,
        type: "number-input",
        duration: "short",
        title: "Question numérique",
        instruction: "Entre un nombre",
        data: {
            answer,
            placeholder: "Nombre",
            validation: { kind: "integer", min: -9999, max: 9999 },
        },
    };
}

describe("QuestNumberInput tolerance", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        Object.defineProperty(navigator, "vibrate", {
            value: vi.fn(),
            writable: true,
            configurable: true,
        });
    });

    it("calls onSuccess for exact answer", () => {
        const onSuccess = vi.fn();
        const onError = vi.fn();
        render(<QuestNumberInput quest={buildQuest(100)} onSuccess={onSuccess} onError={onError} />);

        const input = screen.getByLabelText("Nombre de la quête");
        fireEvent.change(input, { target: { value: "100" } });
        fireEvent.submit(input.closest("form")!);

        expect(onSuccess).toHaveBeenCalledTimes(1);
        expect(onError).not.toHaveBeenCalled();
    });

    it("shows almost feedback for answer within +/-5% and does not fail", () => {
        const onSuccess = vi.fn();
        const onError = vi.fn();
        render(<QuestNumberInput quest={buildQuest(100)} onSuccess={onSuccess} onError={onError} />);

        const input = screen.getByLabelText("Nombre de la quête");
        fireEvent.change(input, { target: { value: "104" } });
        fireEvent.submit(input.closest("form")!);

        expect(screen.getByText("Presque, essaye encore !")).toBeTruthy();
        expect(onSuccess).not.toHaveBeenCalled();
        expect(onError).not.toHaveBeenCalled();
    });

    it("calls onError when answer is outside tolerance range", () => {
        const onSuccess = vi.fn();
        const onError = vi.fn();
        render(<QuestNumberInput quest={buildQuest(100)} onSuccess={onSuccess} onError={onError} />);

        const input = screen.getByLabelText("Nombre de la quête");
        fireEvent.change(input, { target: { value: "106" } });
        fireEvent.submit(input.closest("form")!);

        expect(onError).toHaveBeenCalledTimes(1);
        expect(onSuccess).not.toHaveBeenCalled();
    });

    it("uses the special zero tolerance window", () => {
        const onSuccess = vi.fn();
        const onError = vi.fn();
        render(<QuestNumberInput quest={buildQuest(0)} onSuccess={onSuccess} onError={onError} />);

        const input = screen.getByLabelText("Nombre de la quête");

        fireEvent.change(input, { target: { value: "1" } });
        fireEvent.submit(input.closest("form")!);
        expect(screen.getByText("Presque, essaye encore !")).toBeTruthy();
        expect(onSuccess).not.toHaveBeenCalled();
        expect(onError).not.toHaveBeenCalled();

        fireEvent.change(input, { target: { value: "2" } });
        fireEvent.submit(input.closest("form")!);
        expect(onError).toHaveBeenCalledTimes(1);
    });
});
