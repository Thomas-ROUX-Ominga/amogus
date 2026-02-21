"use client";

import { useState, useCallback } from "react";
import { QuestGame } from "@/types/quest";

interface UseQuestAnswerReturn {
    selectedValue: string | null;
    isCorrect: boolean | null;
    answered: boolean;
    failed: boolean;
    handleAnswer: (value: string) => void;
    handleRetry: () => void;
}

export function useQuestAnswer(
    quest: QuestGame,
    onSuccess: () => void,
    onError: () => void
): UseQuestAnswerReturn {
    const [selectedValue, setSelectedValue] = useState<string | null>(null);
    const [isCorrect, setIsCorrect] = useState<boolean | null>(null);

    const answered = isCorrect === true;
    const failed = isCorrect === false;

    const handleAnswer = useCallback((value: string) => {
        // Guard: ignore clicks if already answered (correct) or in error state (must retry first)
        if (isCorrect !== null) return;

        const correct = value === quest.answer;
        setSelectedValue(value);
        setIsCorrect(correct);

        try {
            if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
                if (correct) {
                    navigator.vibrate([50, 50, 50]);
                } else {
                    navigator.vibrate([200]);
                }
            }
        } catch {
            // Ignore haptic failures
        }

        if (correct) {
            onSuccess();
        } else {
            onError();
        }
    }, [quest.answer, onSuccess, onError, isCorrect]);

    const handleRetry = useCallback(() => {
        setSelectedValue(null);
        setIsCorrect(null);
    }, []);

    return { selectedValue, isCorrect, answered, failed, handleAnswer, handleRetry };
}
