import { QuestDuration } from "@/types/quest";

export const AVAILABLE_MINI_GAMES = ["mini-bac", "simon", "wires", "gauges", "pad", "memory"] as const;
export type MiniGameId = typeof AVAILABLE_MINI_GAMES[number];

export function getRandomMiniGame(): MiniGameId {
    const index = Math.floor(Math.random() * AVAILABLE_MINI_GAMES.length);
    return AVAILABLE_MINI_GAMES[index];
}

// Number of categories per duration
export const MINI_BAC_CATEGORY_COUNT: Record<QuestDuration, number> = {
    short: 4,
    medium: 6,
    long: 8,
};

// Target sequence length for Simon per duration
export const SIMON_SEQUENCE_LENGTH: Record<QuestDuration, number> = {
    short: 4,
    medium: 5,
    long: 6,
};

// Number of wires to connect per duration
export const WIRES_COUNT_BY_DURATION: Record<QuestDuration, number> = {
    short: 4,
    medium: 5,
    long: 6,
};

export const GAUGES_COUNT_BY_DURATION: Record<QuestDuration, number> = {
    short: 4,
    medium: 5,
    long: 6,
};

export const GAUGE_ALIGNMENT_TOLERANCE_PERCENT = 1;

export const PAD_SEQUENCE_LENGTH: Record<QuestDuration, number> = {
    short: 3,
    medium: 4,
    long: 5,
};

export const MEMORY_PAIR_COUNT_BY_DURATION: Record<QuestDuration, number> = {
    short: 4,
    medium: 5,
    long: 6,
};

export const MEMORY_MISMATCH_FLIPBACK_DELAY_MS = 700;
