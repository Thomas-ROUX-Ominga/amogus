"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
    Bird,
    Bug,
    Cat,
    Fish,
    Flower2,
    Leaf,
    LucideIcon,
    Star,
} from "lucide-react";
import { QuestDuration } from "@/types/quest";
import {
    MEMORY_MISMATCH_FLIPBACK_DELAY_MS,
    MEMORY_PAIR_COUNT_BY_DURATION,
} from "@/lib/mini-games";

interface MemoryCard {
    id: string;
    iconKey: string;
    isFlipped: boolean;
    isMatched: boolean;
}

const ICON_POOL: Array<{ key: string; icon: LucideIcon }> = [
    { key: "bird", icon: Bird },
    { key: "bug", icon: Bug },
    { key: "cat", icon: Cat },
    { key: "fish", icon: Fish },
    { key: "flower", icon: Flower2 },
    { key: "leaf", icon: Leaf },
    { key: "star", icon: Star },
];

const GRID_COLUMNS_CLASS_BY_DURATION: Record<QuestDuration, string> = {
    short: "grid-cols-3 sm:grid-cols-4",
    medium: "grid-cols-3 sm:grid-cols-5",
    long: "grid-cols-3 sm:grid-cols-4",
};

const GRID_MAX_WIDTH_BY_DURATION: Record<QuestDuration, string> = {
    short: "max-w-[320px] sm:max-w-[420px]",
    medium: "max-w-[320px] sm:max-w-[520px]",
    long: "max-w-[320px] sm:max-w-[520px]",
};

function shuffle<T>(items: T[]): T[] {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}

function createCards(duration: QuestDuration): MemoryCard[] {
    const pairCount = MEMORY_PAIR_COUNT_BY_DURATION[duration];
    const selectedIcons = shuffle(ICON_POOL).slice(0, pairCount);

    const duplicatedCards = selectedIcons.flatMap((entry, index) => [
        { id: `${entry.key}-${index}-a`, iconKey: entry.key, isFlipped: false, isMatched: false },
        { id: `${entry.key}-${index}-b`, iconKey: entry.key, isFlipped: false, isMatched: false },
    ]);

    return shuffle(duplicatedCards);
}

interface QuestMemoryProps {
    duration: QuestDuration;
    onSuccess: () => void;
    onError: () => void;
}

interface MemoryState {
    cards: MemoryCard[];
    flippedIndexes: number[];
    isLocked: boolean;
    matchedPairsCount: number;
    isCompleted: boolean;
}

function createMemoryState(duration: QuestDuration): MemoryState {
    return {
        cards: createCards(duration),
        flippedIndexes: [],
        isLocked: false,
        matchedPairsCount: 0,
        isCompleted: false,
    };
}

export function QuestMemory({ duration, onSuccess, onError }: QuestMemoryProps) {
    const t = useTranslations();
    // Memory has no failure state.
    void onError;

    const pairCount = MEMORY_PAIR_COUNT_BY_DURATION[duration];
    const [memoryState, setMemoryState] = useState<MemoryState>(() => createMemoryState(duration));
    const { cards, flippedIndexes, isLocked, matchedPairsCount, isCompleted } = memoryState;

    useEffect(() => {
        setMemoryState(createMemoryState(duration));
    }, [duration]);

    const iconByKey = useMemo(
        () => Object.fromEntries(ICON_POOL.map((entry) => [entry.key, entry.icon])) as Record<string, LucideIcon>,
        []
    );

    useEffect(() => {
        if (!isCompleted && matchedPairsCount === pairCount) {
            setMemoryState((prev) => ({ ...prev, isCompleted: true }));
            onSuccess();
        }
    }, [matchedPairsCount, pairCount, isCompleted, onSuccess]);

    const handleCardClick = useCallback(
        (clickedIndex: number) => {
            if (isLocked || isCompleted) return;

            const clickedCard = cards[clickedIndex];
            if (!clickedCard || clickedCard.isFlipped || clickedCard.isMatched) return;

            const nextFlipped = [...flippedIndexes, clickedIndex];
            setMemoryState((prev) => ({
                ...prev,
                cards: prev.cards.map((card, index) =>
                    index === clickedIndex ? { ...card, isFlipped: true } : card
                ),
                flippedIndexes: nextFlipped,
            }));

            if (nextFlipped.length < 2) return;

            const firstIndex = nextFlipped[0];
            const secondIndex = nextFlipped[1];
            const firstCard = cards[firstIndex];
            const secondCard = cards[secondIndex];
            const isMatch = firstCard.iconKey === secondCard.iconKey;

            setMemoryState((prev) => ({ ...prev, isLocked: true }));

            if (isMatch) {
                setMemoryState((prev) => ({
                    ...prev,
                    cards: prev.cards.map((card, index) =>
                        index === firstIndex || index === secondIndex
                            ? { ...card, isMatched: true, isFlipped: true }
                            : card
                    ),
                    matchedPairsCount: prev.matchedPairsCount + 1,
                    flippedIndexes: [],
                    isLocked: false,
                }));
                return;
            }

            setTimeout(() => {
                setMemoryState((prev) => ({
                    ...prev,
                    cards: prev.cards.map((card, index) =>
                        index === firstIndex || index === secondIndex
                            ? { ...card, isFlipped: false }
                            : card
                    ),
                    flippedIndexes: [],
                    isLocked: false,
                }));
            }, MEMORY_MISMATCH_FLIPBACK_DELAY_MS);
        },
        [cards, flippedIndexes, isLocked, isCompleted]
    );

    return (
        <div className="space-y-4">
            <div className="text-center space-y-1">
                <p className="font-rajdhani text-sm uppercase tracking-[0.2em] text-primary/70">
                    {t("game.miniGames.memoryInstruction")}
                </p>
                <p className="font-rajdhani text-xs text-foreground/70" aria-live="polite">
                    {t("game.miniGames.memoryPairsFound", {
                        found: String(matchedPairsCount),
                        total: String(pairCount),
                    })}
                </p>
            </div>

            <div className="border border-primary/20 bg-black/40 backdrop-blur-sm p-2 sm:p-3">
                <div
                    className={`grid gap-1.5 sm:gap-2 mx-auto ${GRID_COLUMNS_CLASS_BY_DURATION[duration]} ${GRID_MAX_WIDTH_BY_DURATION[duration]}`}
                >
                    {cards.map((card, index) => {
                        const Icon = iconByKey[card.iconKey];
                        const isRevealed = card.isFlipped || card.isMatched;
                        return (
                            <button
                                key={card.id}
                                type="button"
                                onClick={() => handleCardClick(index)}
                                data-testid={`memory-card-${index}`}
                                data-icon-key={card.iconKey}
                                data-state={card.isMatched ? "matched" : isRevealed ? "flipped" : "hidden"}
                                aria-label={t("game.miniGames.memoryCardAria", { index: String(index + 1) })}
                                aria-pressed={isRevealed}
                                disabled={isLocked || card.isMatched}
                                className={`aspect-square min-h-[44px] rounded-sm border transition-all ${
                                    card.isMatched
                                        ? "border-role-crewmate bg-role-crewmate/20 text-role-crewmate shadow-[0_0_10px_rgba(45,164,78,0.35)]"
                                        : isRevealed
                                            ? "border-primary/25 bg-black/70 text-foreground"
                                            : "border-primary/40 bg-primary/10 text-primary/70 hover:bg-primary/15"
                                } ${isLocked && !card.isMatched ? "cursor-not-allowed" : ""}`}
                            >
                                {isRevealed ? (
                                    <Icon className="w-5 h-5 sm:w-6 sm:h-6 mx-auto" />
                                ) : (
                                    <span className="text-lg sm:text-xl font-orbitron leading-none">?</span>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
