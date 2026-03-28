"use client";

import { useState, useCallback } from "react";
import { QuestGame } from "@/types/quest";

export type AnswerValidationResult = "correct" | "almost" | "wrong";

interface UseQuestAnswerOptions {
    hasTolerance?: boolean;
    almostMessage?: string;
}

interface UseQuestAnswerReturn<T> {
    selectedValue: T | null;
    isCorrect: boolean | null;
    answered: boolean;
    failed: boolean;
    almost: boolean;
    feedbackMessage: string | null;
    handleAnswer: (value: T) => void;
    handleRetry: () => void;
    clearFeedback: () => void;
}

export function useQuestAnswer<T>(
    quest: QuestGame,
    validateAnswer: (value: T) => AnswerValidationResult,
    onSuccess: () => void,
    onError: () => void,
    options: UseQuestAnswerOptions = {}
): UseQuestAnswerReturn<T> {
    void quest;
    const { hasTolerance = false, almostMessage = "" } = options;
    const [selectedValue, setSelectedValue] = useState<T | null>(null);
    const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
    const [almost, setAlmost] = useState(false);
    const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

    const answered = isCorrect === true;
    const failed = isCorrect === false;

    const handleAnswer = useCallback((value: T) => {
        // Guard: ignore clicks if already answered (correct) or in error state (must retry first)
        if (isCorrect !== null) return;

        setSelectedValue(value);

        const result = validateAnswer(value);
        const shouldTreatAlmostAsWrong = result === "almost" && !hasTolerance;

        if (result === "almost" && hasTolerance) {
            setAlmost(true);
            setFeedbackMessage(almostMessage);
            return;
        }

        setAlmost(false);
        setFeedbackMessage(null);
        const correct = result === "correct";
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
        } else if (result === "wrong" || shouldTreatAlmostAsWrong) {
            onError();
        }
    }, [validateAnswer, onSuccess, onError, isCorrect, hasTolerance, almostMessage]);

    const handleRetry = useCallback(() => {
        setSelectedValue(null);
        setIsCorrect(null);
        setAlmost(false);
        setFeedbackMessage(null);
    }, []);

    const clearFeedback = useCallback(() => {
        setAlmost(false);
        setFeedbackMessage(null);
    }, []);

    return {
        selectedValue,
        isCorrect,
        answered,
        failed,
        almost,
        feedbackMessage,
        handleAnswer,
        handleRetry,
        clearFeedback,
    };
}
