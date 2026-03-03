"use client";

import { useState, useCallback } from "react";
import { QuestGame } from "@/types/quest";

interface UseQuestAnswerReturn<T> {
    selectedValue: T | null;
    isCorrect: boolean | null;
    answered: boolean;
    failed: boolean;
    handleAnswer: (value: T) => void;
    handleRetry: () => void;
}

export function useQuestAnswer<T>(
    quest: QuestGame,
    validateAnswer: (value: T) => boolean,
    onSuccess: () => void,
    onError: () => void
): UseQuestAnswerReturn<T> {
    const [selectedValue, setSelectedValue] = useState<T | null>(null);
    const [isCorrect, setIsCorrect] = useState<boolean | null>(null);

    const answered = isCorrect === true;
    const failed = isCorrect === false;

    const handleAnswer = useCallback((value: T) => {
        // Guard: ignore clicks if already answered (correct) or in error state (must retry first)
        if (isCorrect !== null) return;

        const correct = validateAnswer(value);
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
    }, [validateAnswer, onSuccess, onError, isCorrect]);

    const handleRetry = useCallback(() => {
        setSelectedValue(null);
        setIsCorrect(null);
    }, []);

    return { selectedValue, isCorrect, answered, failed, handleAnswer, handleRetry };
}
