"use client";

import { useState, useCallback, useEffect } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { QuestDuration } from "@/types/quest";
import { MINI_BAC_CATEGORY_COUNT } from "@/lib/mini-games";
import { FailedOverlay } from "@/components/game/failed-overlay";
import categoriesData from "@/lib/constants/mini-bac-categories.json";
import { normalize, isCategoryValid } from "@/lib/utils/word-utils";

interface Category {
    name: string;
    type: "common" | "proper";
}

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
// Letters too hard to start with in French — exclude X, Y, Z, W, K
const EASY_LETTERS = ALPHABET.filter(
    (l) => !["X", "Y", "Z", "W", "K"].includes(l)
);

interface MiniBacState {
    letter: string;
    categories: Category[];
    answers: string[];
}

function pickLetter(): string {
    return EASY_LETTERS[Math.floor(Math.random() * EASY_LETTERS.length)];
}

function pickCategories(count: number): Category[] {
    const all = [...(categoriesData.categories as Category[])];
    const picked: Category[] = [];
    for (let i = 0; i < count && all.length > 0; i++) {
        const idx = Math.floor(Math.random() * all.length);
        picked.push(all.splice(idx, 1)[0]);
    }
    return picked;
}

function generateState(duration: QuestDuration): MiniBacState {
    const categoryCount = MINI_BAC_CATEGORY_COUNT[duration];
    const letter = pickLetter();
    const categories = pickCategories(categoryCount);
    return {
        letter,
        categories,
        answers: Array(categories.length).fill(letter),
    };
}

interface QuestMiniBacProps {
    duration: QuestDuration;
    onSuccess: () => void;
    onError: () => void;
}

export function QuestMiniBac({ duration, onSuccess, onError }: QuestMiniBacProps) {
    const prefersReducedMotion = useReducedMotion();
    const [gameState, setGameState] = useState<MiniBacState>(() =>
        generateState(duration)
    );
    const [errors, setErrors] = useState<boolean[]>([]);
    const [submitted, setSubmitted] = useState(false);
    const [showFailed, setShowFailed] = useState(false);

    // Reset submitted state when game state changes (new round)
    useEffect(() => {
        setSubmitted(false);
        setErrors([]);
    }, [gameState]);

    const handleInputChange = useCallback(
        (index: number, value: string) => {
            const { letter } = gameState;
            // Force first character to always be the drawn letter (accent-insensitive)
            let sanitized = value;
            if (normalize(sanitized).charAt(0) !== normalize(letter)) {
                sanitized = letter + sanitized.replace(new RegExp(`^[${letter}${letter.toLowerCase()}]`, "i"), "");
            }
            setGameState((prev) => {
                const newAnswers = [...prev.answers];
                newAnswers[index] = sanitized;
                return { ...prev, answers: newAnswers };
            });
        },
        [gameState]
    );

    const handleSubmit = useCallback(
        async (e: React.FormEvent) => {
            e.preventDefault();
            if (submitted) return;

            const { answers, letter, categories } = gameState;
            const errorFlags = await Promise.all(
                answers.map(async (word, index) => {
                    const trimmed = word.trim();
                    const category = categories[index];
                    // Must start with the right letter (accent-insensitive)
                    if (normalize(trimmed).charAt(0) !== normalize(letter)) return true;
                    // For proper nouns, we might allow shorter words, but generally 2 is a good minimum
                    if (trimmed.length < 2) return true;
                    return !(await isCategoryValid(trimmed, category.type));
                })
            );

            setErrors(errorFlags);

            if (errorFlags.every((e) => !e)) {
                // All correct → success!
                setSubmitted(true);
                onSuccess();
            } else {
                // Some invalid words → show failed overlay, then reload
                setSubmitted(true);
                setShowFailed(true);
                onError();
            }
        },
        [gameState, submitted, onSuccess, onError]
    );

    const handleRetry = useCallback(() => {
        setShowFailed(false);
        setGameState(generateState(duration));
    }, [duration]);

    const allFilled = gameState.answers.every(
        (a) => a.trim().length >= 2
    );

    return (
        <>
            <form
                onSubmit={handleSubmit}
                className="space-y-5 max-w-3xl mx-auto"
                aria-label="Formulaire Mini-Bac"
            >
                {/* Letter display */}
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6 p-4">
                    <motion.div
                        key={gameState.letter}
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: "spring", stiffness: 300, damping: 20 }}
                        className="w-24 h-24 flex items-center justify-center border-2 border-primary/60 shrink-0 "
                    >
                        <span className="text-5xl font-bold font-orbitron text-primary tracking-widest">
                            {gameState.letter}
                        </span>
                    </motion.div>
                    <div className="text-center sm:text-left max-w-md space-y-1">
                        <p className="font-rajdhani text-sm uppercase tracking-[0.2em] text-primary/70">
                            Mini-Bac
                        </p>
                        <p className="font-rajdhani text-xs text-foreground/70">
                            Trouve un mot valide pour chaque catégorie en commençant par la lettre affichée.
                        </p>
                    </div>
                </div>

                {/* Category inputs */}
                <div className="space-y-3 max-w-2xl mx-auto w-full">
                    {gameState.categories.map((category, index) => {
                        const hasError = errors[index] === true;
                        return (
                            <motion.div
                                key={`${gameState.letter}-${category.name}`}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: index * 0.05 }}
                                className="flex flex-col gap-1"
                            >
                                <label
                                    htmlFor={`minibac-input-${index}`}
                                    className="text-xs uppercase tracking-widest text-primary/60 font-[family-name:var(--font-jetbrains-mono)]"
                                >
                                    {category.name} ({category.type === "proper" ? "nom propre" : "nom commun"})
                                </label>
                                <motion.input
                                    id={`minibac-input-${index}`}
                                    type="text"
                                    value={gameState.answers[index]}
                                    onChange={(e) => handleInputChange(index, e.target.value)}
                                    disabled={submitted}
                                    animate={
                                        hasError && !prefersReducedMotion
                                            ? { x: [-4, 4, -4, 4, 0], transition: { duration: 0.3 } }
                                            : {}
                                    }
                                    className={`w-full min-h-[48px] px-4 py-3 border-2 font-rajdhani font-bold text-base transition-colors touch-manipulation backdrop-blur-sm bg-black/50 text-foreground/90 focus:outline-none ${
                                        hasError
                                            ? "border-[#DA3633] text-[#DA3633]"
                                            : "border-primary/20 focus:border-primary/40 focus:bg-primary/5"
                                    }`}
                                    aria-label={`Mot commençant par ${gameState.letter} pour la catégorie ${category.name}`}
                                    aria-invalid={hasError}
                                    autoComplete="off"
                                    autoCapitalize="none"
                                    spellCheck={false}
                                />
                                {hasError && (
                                    <p className="text-[10px] text-[#DA3633] font-rajdhani" role="alert">
                                        Mot invalide ou inexistant
                                    </p>
                                )}
                            </motion.div>
                        );
                    })}
                </div>

                {/* Submit button */}
                <button
                    type="submit"
                    disabled={submitted || !allFilled}
                    className="w-full max-w-2xl mx-auto min-h-[44px] flex items-center justify-center border-2 border-primary/80 bg-primary/20 text-primary font-rajdhani text-sm uppercase tracking-widest hover:bg-primary/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
                    aria-label="Valider les réponses"
                >
                    Valider
                </button>
            </form>

            <AnimatePresence>
                {showFailed && (
                    <FailedOverlay
                        onAutoExit={handleRetry}
                        reducedMotion={!!prefersReducedMotion}
                        duration={2000}
                    />
                )}
            </AnimatePresence>
        </>
    );
}
