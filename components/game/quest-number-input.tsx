"use client";

import { useState } from "react";
import { m, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import { QuestGame } from "@/types/quest";
import { AnswerValidationResult, useQuestAnswer } from "@/hooks/use-quest-answer";

interface QuestNumberInputProps {
    quest: Extract<QuestGame, { type: "number-input" }>;
    onSuccess: () => void;
    onError: () => void;
}

const NUMBER_TOLERANCE_RATIO = 0.05;
const ZERO_ANSWER_ABSOLUTE_TOLERANCE = 1;

export function QuestNumberInput({ quest, onSuccess, onError }: QuestNumberInputProps) {
    const t = useTranslations();
    const prefersReducedMotion = useReducedMotion();
    const { isCorrect, answered, failed, almost, feedbackMessage, handleAnswer, handleRetry, clearFeedback } = useQuestAnswer(
        quest,
        (val: string): AnswerValidationResult => {
            const numericVal = Number.parseFloat(val);
            const expected = quest.data.answer;

            if (Number.isNaN(numericVal)) {
                return "wrong";
            }

            if (numericVal === expected) {
                return "correct";
            }

            if (expected === 0) {
                return Math.abs(numericVal) <= ZERO_ANSWER_ABSOLUTE_TOLERANCE ? "almost" : "wrong";
            }

            const toleratedDelta = Math.abs(expected) * NUMBER_TOLERANCE_RATIO;
            return Math.abs(numericVal - expected) <= toleratedDelta ? "almost" : "wrong";
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
        const base = "w-full min-h-[48px] flex items-center px-4 py-3 border-2 font-rajdhani font-bold text-base transition-colors touch-manipulation backdrop-blur-sm bg-black/50 text-foreground/90 focus:outline-none focus:ring-2 focus:ring-primary/35";

        if (isCorrect !== null) {
            if (isCorrect) {
                return `${base} border-role-crewmate text-role-crewmate`;
            }
            return `${base} border-role-impostor text-role-impostor`;
        }

        return `${base} border-primary/20 focus:border-primary/40 focus:bg-primary/5`;
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-3">
            <m.div {...getVariants()}>
                <input
                    type="number"
                    value={inputValue}
                    onChange={(e) => {
                        setInputValue(e.target.value);
                        clearFeedback();
                    }}
                    disabled={answered || failed}
                    className={getInputStyle()}
                    placeholder={t("game.questWidgets.numberAria")}
                    aria-label={t("game.questWidgets.numberAria")}
                />
            </m.div>

            {almost && feedbackMessage && (
                <p className="text-sm font-rajdhani text-warning" role="status" aria-live="polite">
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
