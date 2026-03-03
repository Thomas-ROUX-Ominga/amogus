"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { QuestGame } from "@/types/quest";
import { useQuestAnswer } from "@/hooks/use-quest-answer";
import { Check } from "lucide-react";

interface QuestQCMProps {
    quest: Extract<QuestGame, { type: "qcm" }>;
    onSuccess: () => void;
    onError: () => void;
}

export function QuestQCM({ quest, onSuccess, onError }: QuestQCMProps) {
    const prefersReducedMotion = useReducedMotion();
    const isMultiple = quest.data.mode === "multiple";
    const [selectedMultipleIds, setSelectedMultipleIds] = useState<string[]>([]);

    const { selectedValue, isCorrect, answered, failed, handleAnswer, handleRetry } = useQuestAnswer<string | string[]>(
        quest,
        (val) => {
            const expected = quest.data.answerIds;
            if (Array.isArray(val)) {
                return val.length === expected.length && val.every((v) => expected.includes(v));
            }
            return expected.length === 1 && expected[0] === val;
        },
        onSuccess,
        onError
    );

    const toggleSelection = (val: string) => {
        if (answered || failed) return;
        if (isMultiple) {
            setSelectedMultipleIds((prev) =>
                prev.includes(val) ? prev.filter((id) => id !== val) : [...prev, val]
            );
        } else {
            handleAnswer(val);
        }
    };

    const getCardVariants = (value: string) => {
        const isSelected = isMultiple
            ? (Array.isArray(selectedValue) ? selectedValue.includes(value) : selectedMultipleIds.includes(value))
            : selectedValue === value;

        if (!isSelected) return {};
        if (isCorrect !== null && isCorrect) {
            return prefersReducedMotion
                ? {}
                : { animate: { scale: [1, 1.02, 1], transition: { duration: 0.3 } } };
        }
        if (isCorrect !== null && !isCorrect) {
            return prefersReducedMotion
                ? {}
                : { animate: { x: [-2, 2, -2, 0], transition: { duration: 0.3 } } };
        }
        return {};
    };

    const getCardStyle = (value: string) => {
        const base = "w-full min-h-[48px] flex items-center px-4 py-3 border-2 font-rajdhani font-bold text-base transition-colors touch-manipulation backdrop-blur-sm relative";

        const isSelected = isMultiple
            ? (Array.isArray(selectedValue) ? selectedValue.includes(value) : selectedMultipleIds.includes(value))
            : selectedValue === value;

        if (isCorrect !== null) {
            if (isSelected) {
                if (isCorrect) {
                    return `${base} border-[#2DA44E] bg-[#2DA44E]/10 text-[#2DA44E]`;
                }
                return `${base} border-[#DA3633] bg-[#DA3633]/10 text-[#DA3633]`;
            }
            // highlight the actual correct answers when failed
            if (failed && quest.data.answerIds.includes(value)) {
                return `${base} border-[#2DA44E]/60 bg-[#2DA44E]/5 text-[#2DA44E]`;
            }
        } else if (isSelected) {
             return `${base} border-primary bg-primary/20 text-primary`;
        }

        return `${base} border-primary/20 bg-black/50 text-foreground/90 hover:bg-primary/10 hover:border-primary/40`;
    };

    return (
        <div className="space-y-3" role={isMultiple ? "group" : "radiogroup"} aria-label="Choix de réponse">
            {isMultiple && !answered && !failed && (
                <p className="text-sm font-rajdhani text-primary/70 mb-2">Sélectionnez plusieurs choix et validez</p>
            )}
            {quest.data.choices.map((option, index) => (
                <motion.button
                    key={option.id}
                    {...getCardVariants(option.id)}
                    className={getCardStyle(option.id)}
                    onClick={() => toggleSelection(option.id)}
                    disabled={answered || failed}
                    role={isMultiple ? "checkbox" : "radio"}
                    aria-checked={isMultiple ? (Array.isArray(selectedValue) ? selectedValue.includes(option.id) : selectedMultipleIds.includes(option.id)) : selectedValue === option.id}
                    aria-label={`Option ${String.fromCharCode(65 + index)}: ${option.label}`}
                    tabIndex={0}
                >
                    <span className="shrink-0 w-6 text-left text-xs font-[family-name:var(--font-jetbrains-mono)] text-foreground/40 uppercase">
                        {String.fromCharCode(65 + index)})
                    </span>
                    <span className="text-left flex-1">{option.label}</span>
                    {isMultiple && (Array.isArray(selectedValue) ? selectedValue.includes(option.id) : selectedMultipleIds.includes(option.id)) && (
                        <Check className="w-4 h-4 ml-2 flex-shrink-0" />
                    )}
                </motion.button>
            ))}

            {isMultiple && !answered && !failed && (
                <button
                    onClick={() => handleAnswer(selectedMultipleIds)}
                    disabled={selectedMultipleIds.length === 0}
                    className="w-full min-h-[44px] flex items-center justify-center border-2 border-primary/80 bg-primary/20 text-primary font-rajdhani text-sm uppercase tracking-widest hover:bg-primary/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation mt-4"
                >
                    Valider
                </button>
            )}

            {failed && (
                <button
                    onClick={() => {
                        setSelectedMultipleIds([]);
                        handleRetry();
                    }}
                    className="w-full min-h-[44px] flex items-center justify-center border border-primary/20 bg-black/30 text-foreground/70 font-rajdhani text-sm uppercase tracking-widest hover:bg-primary/10 transition-colors touch-manipulation mt-4"
                    aria-label="Réessayer la question"
                >
                    Réessayer
                </button>
            )}
        </div>
    );
}
