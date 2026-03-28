import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useQuestAnswer } from "@/hooks/use-quest-answer";
import { QuestGame } from "@/types/quest";

const mockQuest: Extract<QuestGame, { type: "true-false" }> = {
    id: "q-hook",
    type: "true-false",
    duration: "short",
    title: "Hook test",
    instruction: "Hook test instruction",
    data: {
        choices: [
            { id: "true", label: "VRAI" },
            { id: "false", label: "FAUX" },
        ],
        answerIds: ["true"],
    },
};

describe("useQuestAnswer", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        Object.defineProperty(navigator, "vibrate", {
            value: vi.fn(),
            writable: true,
            configurable: true,
        });
    });

    it("marks answer as correct and calls onSuccess", () => {
        const onSuccess = vi.fn();
        const onError = vi.fn();
        const { result } = renderHook(() =>
            useQuestAnswer(mockQuest, () => "correct", onSuccess, onError)
        );

        act(() => {
            result.current.handleAnswer("true");
        });

        expect(result.current.answered).toBe(true);
        expect(result.current.failed).toBe(false);
        expect(result.current.almost).toBe(false);
        expect(onSuccess).toHaveBeenCalledTimes(1);
        expect(onError).not.toHaveBeenCalled();
    });

    it("keeps quest active for almost result when tolerance is enabled", () => {
        const onSuccess = vi.fn();
        const onError = vi.fn();
        const { result } = renderHook(() =>
            useQuestAnswer(mockQuest, () => "almost", onSuccess, onError, {
                hasTolerance: true,
                almostMessage: "Presque, essaye encore !",
            })
        );

        act(() => {
            result.current.handleAnswer("close");
        });

        expect(result.current.answered).toBe(false);
        expect(result.current.failed).toBe(false);
        expect(result.current.almost).toBe(true);
        expect(result.current.feedbackMessage).toBe("Presque, essaye encore !");
        expect(onSuccess).not.toHaveBeenCalled();
        expect(onError).not.toHaveBeenCalled();
    });

    it("treats almost as wrong when tolerance is disabled", () => {
        const onSuccess = vi.fn();
        const onError = vi.fn();
        const { result } = renderHook(() =>
            useQuestAnswer(mockQuest, () => "almost", onSuccess, onError)
        );

        act(() => {
            result.current.handleAnswer("close");
        });

        expect(result.current.answered).toBe(false);
        expect(result.current.failed).toBe(true);
        expect(result.current.almost).toBe(false);
        expect(result.current.feedbackMessage).toBeNull();
        expect(onSuccess).not.toHaveBeenCalled();
        expect(onError).toHaveBeenCalledTimes(1);
    });

    it("marks answer as failed and calls onError for wrong result", () => {
        const onSuccess = vi.fn();
        const onError = vi.fn();
        const { result } = renderHook(() =>
            useQuestAnswer(mockQuest, () => "wrong", onSuccess, onError)
        );

        act(() => {
            result.current.handleAnswer("false");
        });

        expect(result.current.answered).toBe(false);
        expect(result.current.failed).toBe(true);
        expect(result.current.almost).toBe(false);
        expect(onSuccess).not.toHaveBeenCalled();
        expect(onError).toHaveBeenCalledTimes(1);
    });
});
