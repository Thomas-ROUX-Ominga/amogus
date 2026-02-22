import { QuestDuration, QuestGame, QuestType } from "@/types/quest";
import longGames from "./long.json";
import mediumGames from "./medium.json";
import shortGames from "./short.json";

const questGamePool = {
    short: shortGames as QuestGame[],
    medium: mediumGames as QuestGame[],
    long: longGames as QuestGame[]
};

export function getQuestGamesByDuration(duration: QuestDuration): QuestGame[] {
    return questGamePool[duration] ?? [];
}

export function getQuestGameById(id: string): QuestGame | undefined {
    const allGames = [
        ...questGamePool.short,
        ...questGamePool.medium,
        ...questGamePool.long
    ];
    return allGames.find((g) => g.id === id);
}

export function getRandomQuestGame(type: QuestType, duration: QuestDuration): QuestGame | null {
    const games = getQuestGamesByDuration(duration);
    const filteredGames = games.filter(g => g.type === type);
    if (filteredGames.length === 0) return null;
    const index = Math.floor(Math.random() * filteredGames.length);
    return filteredGames[index];
}

/**
 * Get random quest game with exclusion list (for rotation logic)
 * @param type - Quest type to filter by
 * @param duration - Quest duration to filter by
 * @param excludedIds - Array of content IDs to exclude
 * @returns Random quest game not in excluded list, or null if none available
 */
export function getRandomQuestGameWithExclusion(
    type: QuestType, 
    duration: QuestDuration, 
    excludedIds: string[]
): QuestGame | null {
    const games = getQuestGamesByDuration(duration);
    const filteredGames = games.filter(g => 
        g.type === type && !excludedIds.includes(g.id)
    );
    
    if (filteredGames.length === 0) {
        // Fallback: if all content is excluded, return any content of the right type
        const fallbackGames = games.filter(g => g.type === type);
        if (fallbackGames.length === 0) return null;
        const index = Math.floor(Math.random() * fallbackGames.length);
        return fallbackGames[index];
    }
    
    const index = Math.floor(Math.random() * filteredGames.length);
    return filteredGames[index];
}

/**
 * Get cryptographically secure random quest game with exclusion list
 * @param type - Quest type to filter by
 * @param duration - Quest duration to filter by
 * @param excludedIds - Array of content IDs to exclude
 * @returns Random quest game not in excluded list, or null if none available
 */
export function getSecureRandomQuestGameWithExclusion(
    type: QuestType, 
    duration: QuestDuration, 
    excludedIds: string[]
): QuestGame | null {
    const games = getQuestGamesByDuration(duration);
    const filteredGames = games.filter(g => 
        g.type === type && !excludedIds.includes(g.id)
    );
    
    let availableGames = filteredGames;
    
    if (filteredGames.length === 0) {
        // Fallback: if all content is excluded, return any content of the right type
        const fallbackGames = games.filter(g => g.type === type);
        if (fallbackGames.length === 0) return null;
        availableGames = fallbackGames;
    }
    
    // Use cryptographically secure random selection
    const randomValues = new Uint32Array(1);
    crypto.getRandomValues(randomValues);
    const index = randomValues[0] % availableGames.length;
    
    return availableGames[index];
}

export function isValidDuration(value: string | null): value is QuestDuration {
    return value === "short" || value === "medium" || value === "long";
}

export function getTotalQuestGamesCount(): number {
    return (questGamePool.short?.length || 0) + (questGamePool.medium?.length || 0) + (questGamePool.long?.length || 0);
}
