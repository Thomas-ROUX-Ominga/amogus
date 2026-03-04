import { QuestDuration } from "@/types/quest";

export const AVAILABLE_MINI_GAMES = ['mini-bac'] as const;
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
