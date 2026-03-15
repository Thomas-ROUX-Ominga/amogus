"use client";

import { m, useReducedMotion } from "framer-motion";
import { QuestGame } from "@/types/quest";
import { useQuestAnswer } from "@/hooks/use-quest-answer";
import { useTranslations } from "next-intl";

interface QuestIntrusProps {
    quest: Extract<QuestGame, { type: "intrus" }>;
    onSuccess: () => void;
    onError: () => void;
}

export function QuestIntrus({ quest, onSuccess, onError }: QuestIntrusProps) {
    const t = useTranslations();
    const prefersReducedMotion = useReducedMotion();
    const { selectedValue, isCorrect, answered, failed, handleAnswer, handleRetry } = useQuestAnswer(
        quest,
        (val: string) => quest.data.answerIds.includes(val),
        onSuccess,
        onError
    );

    const getCardVariants = (value: string) => {
        if (selectedValue !== value) return {};
        if (isCorrect) {
            return prefersReducedMotion
                ? {}
                : { animate: { scale: [1, 1.02, 1], transition: { duration: 0.3 } } };
        }
        return prefersReducedMotion
            ? {}
            : { animate: { x: [-2, 2, -2, 0], transition: { duration: 0.3 } } };
    };

    const getCardStyle = (value: string) => {
        const base = "w-full min-h-[48px] flex items-center px-4 py-3 border-2 font-rajdhani font-bold text-base transition-colors touch-manipulation backdrop-blur-sm";

        if (selectedValue === value) {
            if (isCorrect) {
                return `${base} border-[#2DA44E] bg-[#2DA44E]/10 text-[#2DA44E]`;
            }
            return `${base} border-[#DA3633] bg-[#DA3633]/10 text-[#DA3633]`;
        }
        // highlight the actual correct answer when failed
        if (failed && quest.data.answerIds.includes(value)) {
            return `${base} border-[#2DA44E]/60 bg-[#2DA44E]/5 text-[#2DA44E]`;
        }

        return `${base} border-primary/20 bg-black/50 text-foreground/90 hover:bg-primary/10 hover:border-primary/40`;
    };

    return (
        <div className="space-y-3" role="radiogroup" aria-label={t("game.questWidgets.intruderChoiceAria")}>
            {quest.data.choices.map((option, index) => (
                <m.button
                    key={option.id}
                    {...getCardVariants(option.id)}
                    style={selectedValue === option.id ? { willChange: "transform" } : undefined}
                    className={getCardStyle(option.id)}
                    onClick={() => handleAnswer(option.id)}
                    disabled={answered || failed}
                    role="radio"
                    aria-checked={selectedValue === option.id}
                    aria-label={t("game.questWidgets.optionAria", {
                        letter: String.fromCharCode(65 + index),
                        label: option.label,
                    })}
                    tabIndex={0}
                >
                    <span className="shrink-0 w-6 text-left text-xs font-[family-name:var(--font-jetbrains-mono)] text-foreground/40 uppercase">
                        {String.fromCharCode(65 + index)})
                    </span>
                    <span className="text-left flex-1">{option.label}</span>
                </m.button>
            ))}

            {failed && (
                <button
                    onClick={handleRetry}
                    className="w-full min-h-[44px] flex items-center justify-center border border-primary/20 bg-black/30 text-foreground/70 font-rajdhani text-sm uppercase tracking-widest hover:bg-primary/10 transition-colors touch-manipulation"
                    aria-label={t("game.questWidgets.retryAria")}
                >
                    {t("common.actions.retry")}
                </button>
            )}
        </div>
    );
}
