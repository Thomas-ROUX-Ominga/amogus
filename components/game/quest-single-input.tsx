"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { QuestGame } from "@/types/quest";
import { useQuestAnswer } from "@/hooks/use-quest-answer";

interface QuestSingleInputProps {
    quest: QuestGame;
    onSuccess: () => void;
    onError: () => void;
}

export function QuestSingleInput({ quest, onSuccess, onError }: QuestSingleInputProps) {
    const prefersReducedMotion = useReducedMotion();
    const { isCorrect, answered, failed, handleAnswer, handleRetry } = useQuestAnswer(quest, onSuccess, onError);
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
            <motion.div {...getVariants()}>
                <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    disabled={answered || failed}
                    className={getInputStyle()}
                    placeholder="Saisissez votre réponse..."
                    aria-label="Réponse de la quête"
                    autoFocus
                />
            </motion.div>

            {failed ? (
                <button
                    type="button"
                    onClick={() => {
                        setInputValue("");
                        handleRetry();
                    }}
                    className="w-full min-h-[44px] flex items-center justify-center border border-primary/20 bg-black/30 text-foreground/70 font-rajdhani text-sm uppercase tracking-widest hover:bg-primary/10 transition-colors touch-manipulation"
                    aria-label="Réessayer la question"
                >
                    Réessayer
                </button>
            ) : (
                <button
                    type="submit"
                    disabled={answered || inputValue.trim() === ""}
                    className="w-full min-h-[44px] flex items-center justify-center border-2 border-primary/80 bg-primary/20 text-primary font-rajdhani text-sm uppercase tracking-widest hover:bg-primary/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
                    aria-label="Valider la réponse"
                >
                    Valider
                </button>
            )}
        </form>
    );
}
