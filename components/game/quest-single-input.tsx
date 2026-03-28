"use client";

import { useState } from "react";
import { m, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import { QuestGame } from "@/types/quest";
import { AnswerValidationResult, useQuestAnswer } from "@/hooks/use-quest-answer";
import { normalize } from "@/lib/utils/word-utils";

interface QuestSingleInputProps {
    quest: Extract<QuestGame, { type: "single-input" }>;
    onSuccess: () => void;
    onError: () => void;
}

function getLevenshteinDistance(a: string, b: string): number {
    const rows = a.length + 1;
    const cols = b.length + 1;
    const matrix = Array.from({ length: rows }, () => new Array<number>(cols).fill(0));

    for (let i = 0; i < rows; i++) {
        matrix[i][0] = i;
    }

    for (let j = 0; j < cols; j++) {
        matrix[0][j] = j;
    }

    for (let i = 1; i < rows; i++) {
        for (let j = 1; j < cols; j++) {
            const substitutionCost = a[i - 1] === b[j - 1] ? 0 : 1;

            matrix[i][j] = Math.min(
                matrix[i - 1][j] + 1,
                matrix[i][j - 1] + 1,
                matrix[i - 1][j - 1] + substitutionCost
            );
        }
    }

    return matrix[rows - 1][cols - 1];
}

export function QuestSingleInput({ quest, onSuccess, onError }: QuestSingleInputProps) {
    const t = useTranslations();
    const prefersReducedMotion = useReducedMotion();
    const { isCorrect, answered, failed, almost, feedbackMessage, handleAnswer, handleRetry, clearFeedback } = useQuestAnswer(
        quest,
        (val: string): AnswerValidationResult => {
            const { validation, answer } = quest.data;
            let input = val;
            let expected = answer;
            if (validation.trim) {
                input = input.trim();
                expected = expected.trim();
            }
            if (validation.case === "insensitive") {
                input = normalize(input);
                expected = normalize(expected);
            }

            if (input === expected) {
                return "correct";
            }

            const typoThreshold = expected.length <= 5 ? 1 : 2;
            const distance = getLevenshteinDistance(input, expected);

            return distance <= typoThreshold ? "almost" : "wrong";
        },
        onSuccess,
        onError,
        {
            hasTolerance: true,
            almostMessage: t("game.questWidgets.almostTryAgain"),
        }
    );
    const [inputValue, setInputValue] = useState("");

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (inputValue.trim() === "") return;
        handleAnswer(inputValue.trim());
    };

    const getVariants = () => {
        if (isCorrect === null) return {};
        if (isCorrect) {
            return prefersReducedMotion
                ? {}
                : { animate: { scale: [1, 1.02, 1], transition: { duration: 0.3 } } };
        }
        return prefersReducedMotion
            ? {}
            : { animate: { x: [-2, 2, -2, 0], transition: { duration: 0.3 } } };
    };

    const getInputStyle = () => {
        const base = "w-full min-h-[48px] flex items-center px-4 py-3 border-2 font-rajdhani font-bold text-base transition-colors touch-manipulation backdrop-blur-sm bg-black/50 text-foreground/90 focus:outline-none";

        if (isCorrect !== null) {
            if (isCorrect) {
                return `${base} border-[#2DA44E] text-[#2DA44E]`;
            }
            return `${base} border-[#DA3633] text-[#DA3633]`;
        }

        return `${base} border-primary/20 focus:border-primary/40 focus:bg-primary/5`;
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-3">
            <m.div {...getVariants()}>
                <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => {
                        setInputValue(e.target.value);
                        clearFeedback();
                    }}
                    disabled={answered || failed}
                    className={getInputStyle()}
                    placeholder={t("game.questWidgets.answerAria")}
                    aria-label={t("game.questWidgets.answerAria")}
                />
            </m.div>

            {almost && feedbackMessage && (
                <p className="text-sm font-rajdhani text-[#D29922]" role="status" aria-live="polite">
                    {feedbackMessage}
                </p>
            )}

            {failed ? (
                <button
                    type="button"
                    onClick={() => {
                        setInputValue("");
                        handleRetry();
                    }}
                    className="w-full min-h-[44px] flex items-center justify-center border border-primary/20 bg-black/30 text-foreground/70 font-rajdhani text-sm uppercase tracking-widest hover:bg-primary/10 transition-colors touch-manipulation"
                    aria-label={t("game.questWidgets.retryAria")}
                >
                    {t("common.actions.retry")}
                </button>
            ) : (
                <button
                    type="submit"
                    disabled={answered || inputValue.trim() === ""}
                    className="w-full min-h-[44px] flex items-center justify-center border-2 border-primary/80 bg-primary/20 text-primary font-rajdhani text-sm uppercase tracking-widest hover:bg-primary/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
                    aria-label={t("game.questWidgets.submitAria")}
                >
                    {t("common.actions.confirm")}
                </button>
            )}
        </form>
    );
}
