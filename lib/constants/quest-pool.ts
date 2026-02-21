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

export function isValidDuration(value: string | null): value is QuestDuration {
    return value === "short" || value === "medium" || value === "long";
}

export function getTotalQuestGamesCount(): number {
    return (questGamePool.short?.length || 0) + (questGamePool.medium?.length || 0) + (questGamePool.long?.length || 0);
}
