"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Check, X } from "lucide-react";
import { Quest } from "@/types/quest";
import { useQuestAnswer } from "@/hooks/use-quest-answer";

interface QuestTrueFalseProps {
    quest: Quest;
    onSuccess: () => void;
    onError: () => void;
}

export function QuestTrueFalse({ quest, onSuccess, onError }: QuestTrueFalseProps) {
    const prefersReducedMotion = useReducedMotion();
    const { selectedValue, isCorrect, answered, failed, handleAnswer, handleRetry } = useQuestAnswer(quest, onSuccess, onError);

    const getButtonVariants = (value: string) => {
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

    const getButtonStyle = (value: string) => {
        const base = "w-full min-h-[56px] flex items-center justify-center gap-3 border-2 font-rajdhani font-bold uppercase tracking-widest text-lg transition-colors touch-manipulation";

        if (selectedValue === value) {
            if (isCorrect) {
                return `${base} border-[#2DA44E] bg-[#2DA44E]/10 text-[#2DA44E]`;
            }
            return `${base} border-[#DA3633] bg-[#DA3633]/10 text-[#DA3633]`;
        }

        if (value === "true") {
            return `${base} border-[#2DA44E]/40 text-[#2DA44E] bg-black/50 backdrop-blur-sm hover:bg-[#2DA44E]/10`;
        }
        return `${base} border-[#DA3633]/40 text-[#DA3633] bg-black/50 backdrop-blur-sm hover:bg-[#DA3633]/10`;
    };

    return (
        <div className="space-y-4" role="group" aria-label="Réponse Vrai ou Faux">
            {quest.options?.map((option) => (
                <motion.button
                    key={option.value}
                    {...getButtonVariants(option.value)}
                    style={selectedValue === option.value ? { willChange: "transform" } : undefined}
                    className={getButtonStyle(option.value)}
                    onClick={() => handleAnswer(option.value)}
                    disabled={answered || failed}
                    aria-label={`Répondre ${option.label}`}
                    tabIndex={0}
                >
                    {option.value === "true" ? (
                        <Check className="w-5 h-5" aria-hidden="true" />
                    ) : (
                        <X className="w-5 h-5" aria-hidden="true" />
                    )}
                    {option.label}
                </motion.button>
            ))}

            {failed && (
                <button
                    onClick={handleRetry}
                    className="w-full min-h-[44px] flex items-center justify-center border border-primary/20 bg-black/30 text-foreground/70 font-rajdhani text-sm uppercase tracking-widest hover:bg-primary/10 transition-colors touch-manipulation"
                    aria-label="Réessayer la question"
                >
                    Réessayer
                </button>
            )}
        </div>
    );
}
